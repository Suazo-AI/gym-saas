"use server";

import { revalidatePath } from "next/cache";

import { getActiveGym } from "@/features/gyms/services/get-active-gym";

import { recordOtherIncomeSchema } from "../schemas/income.schema";
import { recordOtherIncome } from "../services/income.repository";

export type IncomeActionState = { ok: boolean; message?: string };

export async function recordOtherIncomeAction(
  _: IncomeActionState,
  formData: FormData,
): Promise<IncomeActionState> {
  try {
    const activeGym = await getActiveGym();
    if (!activeGym) return { ok: false, message: "No hay gimnasio activo." };

    const input = recordOtherIncomeSchema.parse({
      gymId: activeGym.gymId,
      incomeCategoryId: formData.get("incomeCategoryId"),
      amount: formData.get("amount"),
      currency: formData.get("currency"),
      branchId: optional(formData, "branchId"),
      reference: optional(formData, "reference"),
      description: optional(formData, "description"),
    });

    await recordOtherIncome(input);
    revalidatePath("/income");
    revalidatePath("/dashboard");
    return { ok: true, message: "Ingreso registrado." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No pudimos registrar el ingreso.",
    };
  }
}

function optional(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
