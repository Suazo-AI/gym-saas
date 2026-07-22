import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

import type { MembershipPlanDto } from "../types/membership.dto";

export async function listMembershipPlans(gymId: string): Promise<MembershipPlanDto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("membership_plans")
    .select("id, code, name, price, currency, billing_cycle_months, grace_days, is_active")
    .eq("gym_id", gymId)
    .is("deleted_at", null)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    throw mapSupabaseError(error);
  }

  return (data ?? []).map(mapPlan);
}

function mapPlan(row: Pick<
  Tables<"membership_plans">,
  "id" | "code" | "name" | "price" | "currency" | "billing_cycle_months" | "grace_days" | "is_active"
>): MembershipPlanDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    price: String(row.price),
    currency: row.currency,
    billingCycleMonths: row.billing_cycle_months,
    graceDays: row.grace_days,
    isActive: row.is_active,
  };
}
