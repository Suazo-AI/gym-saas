import { redirect } from "next/navigation";
import { cache } from "react";

import { ApiError } from "@/lib/api/api-error";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  return data.user;
});

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user;
}

export async function requireApiUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new ApiError("UNAUTHENTICATED", "Debes iniciar sesión.");
  }

  return user;
}

export function getAuthCallbackUrl(path = "/auth/callback") {
  return new URL(path, env.NEXT_PUBLIC_SITE_URL).toString();
}
