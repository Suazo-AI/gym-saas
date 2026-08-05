"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/api-error";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";

import { deleteStaffSchema, inviteStaffSchema, updateStaffSchema } from "../schemas/staff.schema";
import { deleteStaffUser, inviteStaffUser, restoreStaffUser, updateStaffUser } from "../services/staff.repository";

export type StaffActionState = { ok: boolean; message?: string };

export async function inviteStaffAction(_state: StaffActionState, formData: FormData): Promise<StaffActionState> {
  return run(async (gymId) => {
    const input = inviteStaffSchema.parse({
      email: formData.get("email"),
      employeeCode: formData.get("employeeCode"),
      roleIds: stringValues(formData, "roleIds"),
    });
    await inviteStaffUser({ gymId, ...input });
    return "Invitacion enviada.";
  });
}

export async function updateStaffAction(_state: StaffActionState, formData: FormData): Promise<StaffActionState> {
  return run(async (gymId) => {
    const input = updateStaffSchema.parse({
      gymId,
      gymUserId: formData.get("gymUserId"),
      employeeCode: formData.get("employeeCode"),
      status: formData.get("status"),
      roleIds: stringValues(formData, "roleIds"),
    });
    await updateStaffUser(input);
    return "Usuario actualizado.";
  });
}

export async function deleteStaffAction(_state: StaffActionState, formData: FormData): Promise<StaffActionState> {
  return run(async () => {
    const input = deleteStaffSchema.parse({ gymUserId: formData.get("gymUserId"), reason: formData.get("reason") });
    await deleteStaffUser(input);
    return "Usuario retirado con borrado logico.";
  });
}

export async function restoreStaffAction(_state: StaffActionState, formData: FormData): Promise<StaffActionState> {
  return run(async () => {
    const gymUserId = String(formData.get("gymUserId") ?? "");
    await restoreStaffUser(gymUserId);
    return "Usuario restaurado.";
  });
}

async function run(operation: (gymId: string) => Promise<string>): Promise<StaffActionState> {
  try {
    const activeGym = await getActiveGym();
    if (!activeGym) return { ok: false, message: "No hay gimnasio activo." };
    const message = await operation(activeGym.gymId);
    revalidatePath("/staff");
    return { ok: true, message };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    return { ok: false, message: "No pudimos completar la operacion." };
  }
}

function stringValues(formData: FormData, key: string) {
  return formData.getAll(key).filter((value): value is string => typeof value === "string");
}
