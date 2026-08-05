import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

import type { MembershipPlanInput, UpdateMembershipPlanInput } from "../schemas/membership-plan.schema";
import type { DeletedMembershipPlanDto, MembershipPlanDto } from "../types/membership.dto";

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
type CreateGateway = { insert: (values: Record<string, unknown>) => Promise<{ error: unknown }> };
type UpdateGateway = { update: (planId: string, gymId: string, values: Record<string, unknown>) => Promise<{ error: unknown }> };
type PermissionGateway = { read: (gymId: string) => Promise<{ data: unknown; error: unknown }> };
type BenefitCreateGateway = { insert: (planId: string, gymId: string, values: Record<string, unknown>) => Promise<{ error: unknown }> };
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
    .select("id, code, name, description, price, currency, billing_cycle_months, duration_count, duration_unit, grace_days, auto_renew, is_active")
    .eq("gym_id", gymId)
    .is("deleted_at", null)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    throw mapSupabaseError(error);
  }

  const plans = (data ?? []).map(mapPlan);
  if (plans.length === 0) return plans;
  const { data: benefits, error: benefitsError } = await supabase
    .from("membership_plan_benefits")
    .select("id, membership_plan_id, benefit_code, description")
    .in("membership_plan_id", plans.map((plan) => plan.id))
    .is("deleted_at", null)
    .order("description", { ascending: true });
  if (benefitsError) throw mapSupabaseError(benefitsError);
  return plans.map((plan) => ({
    ...plan,
    benefits: (benefits ?? []).filter((benefit) => benefit.membership_plan_id === plan.id).map((benefit) => ({
      id: benefit.id,
      benefitCode: benefit.benefit_code,
      description: benefit.description,
    })),
  }));
}

export async function createMembershipPlan(input: MembershipPlanInput & { gymId: string }, injected?: CreateGateway) {
  const gateway = injected ?? await createGateway();
  const { error } = await gateway.insert(planValues(input, input.gymId));
  if (error) throw mapSupabaseError(error);
}

export async function updateMembershipPlan(input: UpdateMembershipPlanInput & { gymId: string }, injected?: UpdateGateway) {
  const gateway = injected ?? await updateGateway();
  const { error } = await gateway.update(input.planId, input.gymId, planValues(input));
  if (error) throw mapSupabaseError(error);
}

export async function retireMembershipPlan(input: { planId: string; reason: string }, injectedRpc?: Rpc) {
  const rpc = injectedRpc ?? await serverRpc();
  const { data, error } = await rpc("soft_delete_entity", { p_entity: "membership_plan", p_id: input.planId, p_reason: input.reason });
  if (error) throw mapSupabaseError(error);
  return data;
}

export async function restoreMembershipPlan(planId: string, injectedRpc?: Rpc) {
  const rpc = injectedRpc ?? await serverRpc();
  const { data, error } = await rpc("restore_entity", { p_entity: "membership_plan", p_id: planId });
  if (error) throw mapSupabaseError(error);
  return data;
}

export async function listDeletedMembershipPlans(gymId: string, injectedRpc?: Rpc): Promise<DeletedMembershipPlanDto[]> {
  const rpc = injectedRpc ?? await serverRpc();
  const { data, error } = await rpc("list_deleted_entities", { p_gym_id: gymId, p_entity: "membership_plan", p_limit: 50, p_offset: 0 });
  if (error) throw mapSupabaseError(error);
  return ((data ?? []) as Array<{ id: string; label: string; deleted_at?: string; deletedAt?: string; deletion_reason?: string | null; reason?: string | null }>).map((row) => ({
    id: row.id,
    label: row.label,
    deletedAt: row.deleted_at ?? row.deletedAt ?? "",
    reason: row.deletion_reason ?? row.reason ?? null,
  }));
}

export async function canManageMembershipPlans(gymId: string, injected?: PermissionGateway): Promise<boolean> {
  const gateway = injected ?? await permissionGateway();
  const { data, error } = await gateway.read(gymId);
  if (error || !data) return false;
  return JSON.stringify(data).includes("memberships.manage");
}

export async function createMembershipPlanBenefit(
  input: { gymId: string; planId: string; benefitCode: string; description: string },
  injected?: BenefitCreateGateway,
) {
  const gateway = injected ?? await benefitCreateGateway();
  const { error } = await gateway.insert(input.planId, input.gymId, { benefit_code: input.benefitCode, description: input.description });
  if (error) throw mapSupabaseError(error);
}

export async function retireMembershipPlanBenefit(input: { benefitId: string; reason: string }, injectedRpc?: Rpc) {
  const rpc = injectedRpc ?? await serverRpc();
  const { data, error } = await rpc("soft_delete_entity", { p_entity: "membership_plan_benefit", p_id: input.benefitId, p_reason: input.reason });
  if (error) throw mapSupabaseError(error);
  return data;
}

function planValues(input: MembershipPlanInput, gymId?: string) {
  return {
    ...(gymId ? { gym_id: gymId } : {}),
    code: input.code,
    name: input.name,
    description: input.description,
    price: input.price,
    currency: input.currency,
    duration_count: input.durationCount,
    duration_unit: input.durationUnit,
    billing_cycle_months: input.durationUnit === "month" ? input.durationCount : 1,
    grace_days: input.graceDays,
    auto_renew: input.autoRenew,
    is_active: input.isActive,
  };
}

async function createGateway(): Promise<CreateGateway> {
  const supabase = await createClient();
  return { insert: async (values) => {
    const { error } = await supabase.from("membership_plans").insert(values as never);
    return { error };
  } };
}

async function updateGateway(): Promise<UpdateGateway> {
  const supabase = await createClient();
  return { update: async (planId, gymId, values) => {
    const { error } = await supabase.from("membership_plans").update(values as never).eq("id", planId).eq("gym_id", gymId).is("deleted_at", null);
    return { error };
  } };
}

async function serverRpc(): Promise<Rpc> {
  const supabase = await createClient();
  return async (name, args) => supabase.rpc(name as never, args as never);
}

async function permissionGateway(): Promise<PermissionGateway> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  return { read: async (gymId) => {
    if (!authData.user) return { data: null, error: null };
    return supabase
      .from("gym_users")
      .select("gym_user_roles(roles(role_permissions(permissions(code))))")
      .eq("gym_id", gymId)
      .eq("auth_user_id", authData.user.id)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();
  } };
}

async function benefitCreateGateway(): Promise<BenefitCreateGateway> {
  const supabase = await createClient();
  return { insert: async (planId, gymId, values) => {
    const { data: plan, error: planError } = await supabase.from("membership_plans").select("id").eq("id", planId).eq("gym_id", gymId).is("deleted_at", null).maybeSingle();
    if (planError || !plan) return { error: planError ?? { code: "PGRST116", message: "Membership plan not found" } };
    const { error } = await supabase.from("membership_plan_benefits").insert({ membership_plan_id: planId, ...values } as never);
    return { error };
  } };
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
  "id" | "code" | "name" | "description" | "price" | "currency" | "billing_cycle_months" | "grace_days" | "is_active"
> & { duration_count: number; duration_unit: string; auto_renew: boolean }): MembershipPlanDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    price: String(row.price),
    currency: row.currency === "USD" ? "USD" : "NIO",
    billingCycleMonths: row.billing_cycle_months,
    durationCount: row.duration_count,
    durationUnit: row.duration_unit === "day" || row.duration_unit === "week" ? row.duration_unit : "month",
    graceDays: row.grace_days,
    autoRenew: row.auto_renew,
    isActive: row.is_active,
    benefits: [],
  };
}
