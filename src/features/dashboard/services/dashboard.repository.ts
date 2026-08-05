import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";

import type { OwnerDashboardDto } from "../types/dashboard.dto";

type DashboardRow = Partial<OwnerDashboardDto>;

export async function getOwnerDashboard(gymId: string): Promise<OwnerDashboardDto> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_owner_dashboard" as never, { p_gym_id: gymId } as never);
  if (error) throw mapSupabaseError(error);
  return mapOwnerDashboard(data as DashboardRow);
}

export function mapOwnerDashboard(row: DashboardRow): OwnerDashboardDto {
  return {
    activeMembers: nullableCount(row.activeMembers),
    expiringMemberships: nullableCount(row.expiringMemberships),
    overdueMembers: nullableCount(row.overdueMembers),
    income: row.income ?? null,
    entriesToday: nullableCount(row.entriesToday),
    openAlerts: nullableCount(row.openAlerts),
  };
}

function nullableCount(value: number | null | undefined) {
  return value == null ? null : Number(value);
}
