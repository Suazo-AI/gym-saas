import { createPagination, normalizePaginationInput } from "@/lib/api/pagination";
import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";

import {
  mapMemberDetailRow,
  mapMemberSummaryRow,
  mapMemberSummaryRows,
} from "../mappers/member.mapper";
import { createMemberSchema, listMembersSchema, updateMemberSchema } from "../schemas/member.schema";
import type {
  CreateMemberInput,
  MemberDetailRow,
  MemberDetailDto,
  MemberSummaryRow,
  PaginatedMembersDto,
  UpdateMemberInput,
  DeletedMemberDto,
} from "../types/member.dto";

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
type PermissionGateway = { read: (gymId: string) => Promise<{ data: boolean | null; error: unknown }> };

type QueryResult<T> = Promise<{ data: T | null; count: number | null; error: unknown }>;

type MemberViewQuery<T> = {
  select: (columns: string, options?: { count?: "exact" }) => MemberViewQuery<T>;
  eq: (column: string, value: unknown) => MemberViewQuery<T>;
  is: (column: string, value: unknown) => MemberViewQuery<T>;
  or: (filters: string) => MemberViewQuery<T>;
  order: (column: string, options?: { ascending?: boolean }) => MemberViewQuery<T>;
  range: (from: number, to: number) => QueryResult<T[]>;
  maybeSingle: () => QueryResult<T>;
};

type MemberViewsClient = {
  from: <T>(relation: string) => MemberViewQuery<T>;
};

const orderByMap = {
  createdAt: "created_at",
  fullName: "full_name",
  memberCode: "member_code",
  nextPaymentDate: "next_payment_date",
} as const;

export async function listMembers(input: unknown): Promise<PaginatedMembersDto> {
  const parsed = listMembersSchema.parse(input);
  const pagination = normalizePaginationInput(parsed);
  const supabase = (await createClient()) as unknown as MemberViewsClient;
  let query = supabase
    .from<MemberSummaryRow>("api_v1_member_summaries")
    .select("*", { count: "exact" })
    .eq("gym_id", parsed.gymId);

  if (parsed.search) {
    query = query.or(`full_name.ilike.%${parsed.search}%,member_code.ilike.%${parsed.search}%`);
  }

  if (parsed.status) {
    query = query.eq("status", parsed.status);
  }

  if (parsed.branchId) {
    query = query.eq("branch_id", parsed.branchId);
  }

  if (parsed.membershipStatus) {
    query = query.eq("membership_status", parsed.membershipStatus);
  }

  if (parsed.hasOverdueCharges !== undefined) {
    query = query.eq("has_overdue_charges", parsed.hasOverdueCharges);
  }

  const { data, count, error } = await query
    .order(orderByMap[parsed.orderBy], { ascending: parsed.orderDirection === "asc" })
    .order("gym_member_id", { ascending: true })
    .range(pagination.from, pagination.to);

  if (error) {
    throw mapSupabaseError(error);
  }

  return {
    data: mapMemberSummaryRows((data ?? []) as MemberSummaryRow[]),
    pagination: createPagination({
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: count ?? 0,
    }),
  };
}

export async function getMember(input: { gymId: string; gymMemberId: string }): Promise<MemberDetailDto | null> {
  const supabase = (await createClient()) as unknown as MemberViewsClient;
  const { data, error } = await supabase
    .from<MemberDetailRow>("api_v1_member_details")
    .select("*")
    .eq("gym_id", input.gymId)
    .eq("gym_member_id", input.gymMemberId)
    .maybeSingle();

  if (error) {
    throw mapSupabaseError(error);
  }

  if (!data) {
    return null;
  }

  return mapMemberDetailRow(data);
}

export async function createMember(input: CreateMemberInput): Promise<string> {
  const parsed = createMemberSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_gym_member" as never, {
    p_gym_id: parsed.gymId,
    p_first_name: parsed.firstName,
    p_last_name: parsed.lastName,
    p_member_code: parsed.memberCode ?? null,
    p_branch_id: parsed.branchId ?? null,
    p_phone: parsed.phone ?? null,
    p_email: parsed.email ?? null,
    p_joined_on: parsed.joinedOn ?? null,
    p_membership_plan_id: parsed.membershipPlanId ?? null,
    p_subscription_start_date: parsed.subscriptionStartDate ?? null,
    p_create_initial_charge: parsed.createInitialCharge ?? false,
    p_payment_method_id: parsed.paymentMethodId ?? null,
    p_payment_amount: parsed.paymentAmount ?? null,
    p_payment_currency: parsed.paymentCurrency ?? null,
    p_payment_paid_at: parsed.paymentPaidAt ?? null,
    p_payment_notes: parsed.paymentNotes ?? null,
  } as never);

  if (error) {
    throw mapSupabaseError(error);
  }

  return data as string;
}

export async function updateMember(input: UpdateMemberInput) {
  const parsed = updateMemberSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_gym_member_admin" as never, {
    p_gym_id: parsed.gymId,
    p_gym_member_id: parsed.gymMemberId,
    p_first_name: parsed.firstName ?? null,
    p_last_name: parsed.lastName ?? null,
    p_member_code: parsed.memberCode ?? null,
    p_branch_id: parsed.branchId ?? null,
    p_clear_branch: parsed.branchId === null,
    p_phone: parsed.phone ?? null,
    p_clear_phone: parsed.phone === "",
    p_email: parsed.email ?? null,
    p_clear_email: parsed.email === "",
  } as never);

  if (error) {
    throw mapSupabaseError(error);
  }

  return mapMemberSummaryRow(data as unknown as MemberSummaryRow);
}

export async function deleteMember(input: { gymMemberId: string; reason?: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("soft_delete_entity", {
    p_entity: "gym_member",
    p_id: input.gymMemberId,
    p_reason: input.reason,
  });

  if (error) {
    throw mapSupabaseError(error);
  }

  return data;
}

export async function restoreMember(input: { gymMemberId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("restore_entity", {
    p_entity: "gym_member",
    p_id: input.gymMemberId,
  });

  if (error) {
    throw mapSupabaseError(error);
  }

  return data;
}

export async function listDeletedMembers(gymId: string, injectedRpc?: Rpc): Promise<DeletedMemberDto[]> {
  const rpc = injectedRpc ?? await serverRpc();
  const { data, error } = await rpc("list_deleted_gym_members", { p_gym_id: gymId, p_limit: 50, p_offset: 0 });
  if (error) throw mapSupabaseError(error);
  return ((data ?? []) as Array<{ id: string; label: string; deleted_at?: string; deletedAt?: string; deletion_reason?: string | null; reason?: string | null }>).map((row) => ({
    id: row.id,
    label: row.label,
    deletedAt: row.deleted_at ?? row.deletedAt ?? "",
    reason: row.deletion_reason ?? row.reason ?? null,
  }));
}

export async function canManageMembers(gymId: string, injected?: PermissionGateway): Promise<boolean> {
  const gateway = injected ?? await permissionGateway();
  const { data, error } = await gateway.read(gymId);
  if (error || !data) return false;
  return data === true;
}

async function serverRpc(): Promise<Rpc> {
  const supabase = await createClient();
  return async (name, args) => supabase.rpc(name as never, args as never);
}

async function permissionGateway(): Promise<PermissionGateway> {
  const supabase = await createClient();
  return { read: async (gymId) => {
    return supabase.rpc("current_user_has_gym_permission", { p_gym_id: gymId, p_permission_code: "members.manage" });
  } };
}
