import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";

import type { PlatformDashboardDto, PlatformGymDetailDto } from "../types/platform.dto";

export async function getPlatformDashboard(): Promise<PlatformDashboardDto> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_platform_dashboard" as never);

  if (error) {
    throw mapSupabaseError(error);
  }

  return data as unknown as PlatformDashboardDto;
}

export async function getPlatformGymDetail(gymId: string): Promise<PlatformGymDetailDto> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_platform_gym_detail" as never, {
    p_gym_id: gymId,
  } as never);

  if (error) {
    throw mapSupabaseError(error);
  }

  return data as unknown as PlatformGymDetailDto;
}
