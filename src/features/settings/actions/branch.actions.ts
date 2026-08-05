"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { ApiError } from "@/lib/api/api-error";
import { branchSchema, restoreBranchSchema, retireBranchSchema, updateBranchSchema } from "../schemas/branch.schema";
import { createBranch, restoreBranch, retireBranch, updateBranch } from "../services/branch.repository";

export type BranchActionState = { ok: boolean; message?: string };

export async function createBranchAction(_: BranchActionState, formData: FormData) { return run(async (gymId) => {
  const input = branchSchema.parse(fields(formData)); await createBranch({ gymId, ...input }); return "Sucursal creada.";
}); }
export async function updateBranchAction(_: BranchActionState, formData: FormData) { return run(async (gymId) => {
  const input = updateBranchSchema.parse({ branchId: formData.get("branchId"), ...fields(formData) }); await updateBranch({ gymId, ...input }); return "Cambios guardados.";
}); }
export async function retireBranchAction(_: BranchActionState, formData: FormData) { return run(async () => {
  const input = retireBranchSchema.parse({ branchId: formData.get("branchId"), reason: formData.get("reason") }); await retireBranch(input); return "Sucursal retirada.";
}); }
export async function restoreBranchAction(_: BranchActionState, formData: FormData) { return run(async () => {
  const { branchId } = restoreBranchSchema.parse({ branchId: formData.get("branchId") }); await restoreBranch(branchId); return "Sucursal restaurada.";
}); }

function fields(formData: FormData) { return { code: formData.get("code"), name: formData.get("name"), city: formData.get("city"), status: formData.get("status") }; }
async function run(operation: (gymId: string) => Promise<string>): Promise<BranchActionState> {
  try {
    const activeGym = await getActiveGym(); if (!activeGym) return { ok: false, message: "No hay un gimnasio seleccionado." };
    const message = await operation(activeGym.gymId); revalidatePath("/settings"); return { ok: true, message };
  } catch (error) {
    if (error instanceof ZodError) return { ok: false, message: error.issues[0]?.message ?? "Revisa los datos ingresados." };
    if (error instanceof ApiError) return { ok: false, message: businessMessage(error) };
    return { ok: false, message: "No pudimos completar la acción." };
  }
}
function businessMessage(error: ApiError) {
  const detail = (error.internalMessage ?? "").toLowerCase();
  if (detail.includes("active members")) return "Primero asigna los miembros vigentes a otra sucursal.";
  if (detail.includes("active access devices")) return "Primero retira o reasigna los dispositivos activos de esta sucursal.";
  return error.message;
}
