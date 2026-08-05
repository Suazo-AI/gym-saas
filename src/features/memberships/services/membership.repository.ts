import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

import { mapAssignedSubscription } from "../mappers/membership.mapper";
import { assignSubscriptionSchema } from "../schemas/membership.schema";
import type {
  AssignedSubscriptionDto,
  AssignedSubscriptionRow,
  AssignSubscriptionInput,
  MembershipPlanDto,
} from "../types/membership.dto";

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

export async function assignMemberSubscription(
  input: AssignSubscriptionInput,
): Promise<AssignedSubscriptionDto> {
  const parsed = assignSubscriptionSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_member_subscription" as never, {
    p_gym_id: parsed.gymId,
    p_gym_member_id: parsed.gymMemberId,
    p_membership_plan_id: parsed.membershipPlanId,
    p_start_date: parsed.startDate ?? null,
    p_billing_cycle_months: parsed.billingCycleMonths ?? null,
    p_recurring_amount: parsed.recurringAmount ?? null,
    p_currency: parsed.currency ?? null,
    p_auto_renew: parsed.autoRenew ?? null,
    p_generate_first_charge: parsed.generateFirstCharge ?? null,
  } as never);

  if (error) {
    throw mapSupabaseError(error);
  }

  return mapAssignedSubscription(data as AssignedSubscriptionRow);
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
