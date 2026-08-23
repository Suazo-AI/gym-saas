"use server";

import { revalidatePath } from "next/cache";

import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { hasGymPermission } from "@/features/gyms/services/require-gym-permission";

import { updateGymLogo } from "../services/gym-logo.repository";

export type GymLogoState = { ok: boolean; message?: string };

export async function updateGymLogoAction(_state: GymLogoState, formData: FormData): Promise<GymLogoState> {
  const gym = await getActiveGym();
  if (!gym) return { ok: false, message: "Tu sesión expiró." };
  const allowed = await Promise.all([hasGymPermission(gym.gymId, "gym.manage"), hasGymPermission(gym.gymId, "media.manage")]);
  if (!allowed.every(Boolean)) return { ok: false, message: "No tienes permiso para cambiar el logo." };
  try {
    await updateGymLogo(gym.gymId, String(formData.get("imageBase64") ?? ""));
    revalidatePath("/", "layout");
    return { ok: true, message: "Logo actualizado." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No pudimos actualizar el logo." };
  }
}
