import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";

import type { UserGymDto } from "../types/gym.dto";

type GymUserRow = {
  id: string;
  status: string;
  gyms: {
    id: string;
    trade_name: string;
    legal_name: string;
    slug: string;
    default_currency: string;
    timezone: string;
  } | null;
};

export async function getUserGyms(): Promise<UserGymDto[]> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return [];
  }

  const { data, error } = await supabase
    .from("gym_users")
    .select(
      "id, status, gyms!inner(id, trade_name, legal_name, slug, default_currency, timezone)",
    )
    .eq("auth_user_id", userData.user.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .is("gyms.deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw mapSupabaseError(error);
  }

  return ((data ?? []) as unknown as GymUserRow[])
    .filter((row) => row.gyms)
    .map((row) => ({
      gymId: row.gyms!.id,
      tradeName: row.gyms!.trade_name,
      legalName: row.gyms!.legal_name,
      slug: row.gyms!.slug,
      defaultCurrency: row.gyms!.default_currency,
      timezone: row.gyms!.timezone,
      userGymId: row.id,
      userStatus: row.status,
    }));
}
