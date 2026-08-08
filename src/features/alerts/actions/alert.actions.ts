"use server";

import { revalidatePath } from "next/cache";

import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { ApiError } from "@/lib/api/api-error";

import { alertTransitionSchema } from "../schemas/alert.schema";
import { transitionGymAlert } from "../services/alert.repository";

export type AlertActionState = { ok: boolean; message?: string };

export async function acknowledgeAlertAction(_: AlertActionState, formData: FormData) {
  return transition(formData, "acknowledged");
}

export async function resolveAlertAction(_: AlertActionState, formData: FormData) {
  return transition(formData, "resolved");
}

async function transition(formData: FormData, status: "acknowledged" | "resolved"): Promise<AlertActionState> {
  try {
    const activeGym = await getActiveGym();
    if (!activeGym) return { ok: false, message: "No hay gimnasio activo." };

    const input = alertTransitionSchema.parse({ alertId: formData.get("alertId"), status });
    await transitionGymAlert({ gymId: activeGym.gymId, ...input });
    revalidatePath("/alerts");
    revalidatePath("/dashboard");
    return { ok: true, message: status === "acknowledged" ? "Alerta reconocida." : "Alerta resuelta." };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    return { ok: false, message: "No pudimos actualizar la alerta." };
  }
}
