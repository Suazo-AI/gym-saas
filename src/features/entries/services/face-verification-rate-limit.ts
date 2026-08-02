import { ApiError } from "@/lib/api/api-error";
import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";

const FACE_VERIFY_LIMIT = 10;
const FACE_VERIFY_WINDOW_SECONDS = 60;

export async function reserveFaceVerificationAttempt(gymId: string): Promise<void> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "reserve_face_verification_attempt" as never,
    {
      p_gym_id: gymId,
      p_limit: FACE_VERIFY_LIMIT,
      p_window_seconds: FACE_VERIFY_WINDOW_SECONDS,
    } as never,
  );

  if (error) {
    throw mapSupabaseError(error);
  }

  if (data !== true) {
    throw new ApiError(
      "RATE_LIMITED",
      "Demasiados intentos. Intenta nuevamente en un minuto.",
    );
  }
}
