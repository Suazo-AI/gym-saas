"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { requireUser } from "@/features/auth/services/auth.service";
import { ApiError } from "@/lib/api/api-error";

import { createPlatformGymSchema } from "../schemas/platform-gym.schema";
import { createPlatformGymWithOwner } from "../services/platform.repository";

export type PlatformGymActionState = { ok: boolean; message?: string };

export async function createPlatformGymAction(
  _state: PlatformGymActionState,
  formData: FormData,
): Promise<PlatformGymActionState> {
  const user = await requireUser();
  if (user.app_metadata?.platform_role !== "admin") {
    return { ok: false, message: "No tienes permiso." };
  }

  let gymId: string;
  try {
    const input = createPlatformGymSchema.parse({
      legalName: formData.get("legalName"),
      tradeName: formData.get("tradeName"),
      slug: formData.get("slug"),
      taxIdentifier: formData.get("taxIdentifier"),
      defaultCurrency: formData.get("defaultCurrency"),
      timezone: formData.get("timezone"),
      ownerName: formData.get("ownerName"),
      ownerEmail: formData.get("ownerEmail"),
    });
    const result = await createPlatformGymWithOwner(input);
    gymId = result.gymId;
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, message: error.issues[0]?.message ?? "Revisa los datos." };
    }
    if (error instanceof ApiError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "No pudimos crear el gimnasio." };
  }

  revalidatePath("/platform");
  revalidatePath("/platform/gyms");
  redirect(`/platform/gyms/${gymId}?created=1`);
}
