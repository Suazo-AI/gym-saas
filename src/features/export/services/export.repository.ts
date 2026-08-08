import { ApiError } from "@/lib/api/api-error";
import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";

export const MAX_EXPORT_ROWS = 1_000;

export type MembersExportInput = {
  gymId: string;
  search?: string;
  status?: string;
  branchId?: string;
  membershipStatus?: string;
  hasOverdueCharges?: boolean;
};

export type PaymentsExportInput = {
  gymId: string;
  from?: string;
  to?: string;
};

type QueryResult = Promise<{
  data: Array<Record<string, unknown>> | null;
  count: number | null;
  error: unknown;
}>;

type ExportQuery = {
  select: (columns: string, options?: { count?: "exact" }) => ExportQuery;
  eq: (column: string, value: unknown) => ExportQuery;
  or: (filters: string) => ExportQuery;
  gte: (column: string, value: string) => ExportQuery;
  lt: (column: string, value: string) => ExportQuery;
  order: (column: string, options?: { ascending?: boolean }) => ExportQuery;
  range: (from: number, to: number) => QueryResult;
};

type ExportClient = {
  from: (relation: string) => ExportQuery;
};

const MEMBER_COLUMNS = [
  "gym_member_id",
  "member_code",
  "full_name",
  "status",
  "branch_name",
  "membership_status",
  "membership_plan_name",
  "next_payment_date",
  "overdue_amount",
  "has_overdue_charges",
  "created_at",
].join(",");

const PAYMENT_COLUMNS = [
  "id",
  "gym_member_id",
  "amount",
  "currency",
  "status",
  "receipt_number",
  "paid_at",
  "applied_nio_per_usd",
].join(",");

export async function listMembersForExport(
  input: MembersExportInput,
): Promise<Record<string, unknown>[]> {
  const supabase = (await createClient()) as unknown as ExportClient;
  let query = supabase
    .from("api_v1_member_summaries")
    .select(MEMBER_COLUMNS, { count: "exact" })
    .eq("gym_id", input.gymId);

  if (input.search) {
    query = query.or(
      `full_name.ilike.%${sanitizeSearch(input.search)}%,member_code.ilike.%${sanitizeSearch(input.search)}%`,
    );
  }

  if (input.status) {
    query = query.eq("status", input.status);
  }

  if (input.branchId) {
    query = query.eq("branch_id", input.branchId);
  }

  if (input.membershipStatus) {
    query = query.eq("membership_status", input.membershipStatus);
  }

  if (input.hasOverdueCharges !== undefined) {
    query = query.eq("has_overdue_charges", input.hasOverdueCharges);
  }

  const result = await query
    .order("created_at", { ascending: false })
    .order("gym_member_id", { ascending: true })
    .range(0, MAX_EXPORT_ROWS);

  return exportRows(result, mapMemberRow);
}

export async function listPaymentsForExport(
  input: PaymentsExportInput,
): Promise<Record<string, unknown>[]> {
  const supabase = (await createClient()) as unknown as ExportClient;
  let query = supabase
    .from("member_payments")
    .select(PAYMENT_COLUMNS, { count: "exact" })
    .eq("gym_id", input.gymId);

  if (input.from) {
    query = query.gte("paid_at", `${input.from}T00:00:00.000Z`);
  }

  if (input.to) {
    query = query.lt("paid_at", startOfNextUtcDay(input.to));
  }

  const result = await query
    .order("paid_at", { ascending: false })
    .order("id", { ascending: true })
    .range(0, MAX_EXPORT_ROWS);

  return exportRows(result, mapPaymentRow);
}

function exportRows(
  result: Awaited<QueryResult>,
  mapper: (row: Record<string, unknown>) => Record<string, unknown>,
): Record<string, unknown>[] {
  if (result.error) {
    throw mapSupabaseError(result.error);
  }

  const rows = result.data ?? [];

  if ((result.count ?? rows.length) > MAX_EXPORT_ROWS || rows.length > MAX_EXPORT_ROWS) {
    throw new ApiError(
      "BUSINESS_RULE_VIOLATION",
      `La exportacion supera el limite de ${MAX_EXPORT_ROWS} filas. Ajusta los filtros e intenta de nuevo.`,
    );
  }

  return rows.map(mapper);
}

function mapMemberRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    memberCode: row.member_code,
    fullName: row.full_name,
    status: row.status,
    branchName: row.branch_name,
    membershipStatus: row.membership_status,
    membershipPlanName: row.membership_plan_name,
    nextPaymentDate: row.next_payment_date,
    overdueAmount: row.overdue_amount,
    hasOverdueCharges: row.has_overdue_charges,
    createdAt: row.created_at,
  };
}

function mapPaymentRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    paymentId: row.id,
    gymMemberId: row.gym_member_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    receiptNumber: row.receipt_number,
    paidAt: row.paid_at,
    appliedNioPerUsd: row.applied_nio_per_usd,
  };
}

function sanitizeSearch(value: string): string {
  return value.replace(/[,%()]/g, " ").trim();
}

function startOfNextUtcDay(date: string): string {
  const nextDay = new Date(`${date}T00:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return nextDay.toISOString();
}
