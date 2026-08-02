import { ApiError } from "@/lib/api/api-error";
import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";

export async function requireGymPermission(
  gymId: string,
  permission: string,
): Promise<void> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "current_user_has_gym_permission" as never,
    {
      p_gym_id: gymId,
      p_permission_code: permission,
    } as never,
  );

  if (error) {
    throw mapSupabaseError(error);
  }

  if (data !== true) {
    throw new ApiError("FORBIDDEN", "No tienes permiso para verificar rostros.");
  }
}
