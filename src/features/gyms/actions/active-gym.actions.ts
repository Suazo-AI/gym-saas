"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ACTIVE_GYM_COOKIE } from "../services/get-active-gym";
import { getUserGyms } from "../services/get-user-gyms";
import type { UserGymDto } from "../types/gym.dto";

export type ActiveGymActionState = { error: string } | null;

type CookieStore = {
  set: (name: string, value: string, options: {
    httpOnly: boolean;
    sameSite: "lax";
    secure: boolean;
    path: string;
  }) => void;
};

type Dependencies = {
  getUserGyms: () => Promise<UserGymDto[]>;
  getCookieStore: () => Promise<CookieStore>;
  revalidate: (path: string, type: "layout") => void;
  redirect: (path: string) => void;
  isProduction: boolean;
};

const gymIdSchema = z.string().uuid();
const genericError = { error: "No pudimos cambiar el gimnasio activo." } as const;

export async function switchActiveGymAction(
  _previousState: ActiveGymActionState,
  formData: FormData,
  injected?: Dependencies,
): Promise<ActiveGymActionState> {
  const dependencies = injected ?? {
    getUserGyms,
    getCookieStore: cookies,
    revalidate: revalidatePath,
    redirect,
    isProduction: process.env.NODE_ENV === "production",
  };

  const parsedGymId = gymIdSchema.safeParse(formData.get("gymId"));
  if (!parsedGymId.success) return genericError;

  try {
    const gyms = await dependencies.getUserGyms();
    if (!gyms.some((gym) => gym.gymId === parsedGymId.data)) return genericError;

    const cookieStore = await dependencies.getCookieStore();
    cookieStore.set(ACTIVE_GYM_COOKIE, parsedGymId.data, {
      httpOnly: true,
      sameSite: "lax",
      secure: dependencies.isProduction,
      path: "/",
    });
    dependencies.revalidate("/", "layout");
  } catch {
    return genericError;
  }

  dependencies.redirect("/dashboard");
  return null;
}
