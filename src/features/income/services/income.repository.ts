import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";
import type { Views } from "@/lib/supabase/types";

import type {
  DailyIncomeDto,
  IncomeBranchDto,
  IncomeCategoryDto,
  IncomeRange,
  MonthlyIncomeDto,
  RecordOtherIncomeInput,
} from "../types/income.dto";

export async function listDailyIncome(
  gymId: string,
  range: IncomeRange = {},
  limit = 100,
): Promise<DailyIncomeDto[]> {
  const supabase = await createClient();
  let query = supabase
    .from("v_gym_income_daily")
    .select("gym_id, income_date, total_income, currency")
    .eq("gym_id", gymId);

  if (range.from) query = query.gte("income_date", range.from);
  if (range.to) query = query.lte("income_date", range.to);
  if (range.currency) query = query.eq("currency", range.currency);

  const { data, error } = await query
    .order("income_date", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));

  if (error) {
    throw mapSupabaseError(error);
  }

  return (data ?? []).map(mapDailyIncome);
}

export async function listMonthlyIncome(
  gymId: string,
  range: IncomeRange = {},
  limit = 60,
): Promise<MonthlyIncomeDto[]> {
  const supabase = (await createClient()) as unknown as IncomeViewsClient;
  let query = supabase
    .from("v_gym_income_monthly")
    .select("gym_id, income_month, total_income, currency")
    .eq("gym_id", gymId);

  if (range.from) query = query.gte("income_month", monthStart(range.from));
  if (range.to) query = query.lte("income_month", monthStart(range.to));
  if (range.currency) query = query.eq("currency", range.currency);

  const { data, error } = await query
    .order("income_month", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 120)));

  if (error) throw mapSupabaseError(error);

  return (data ?? []).map((row) => ({
    gymId: row.gym_id,
    incomeMonth: row.income_month,
    totalIncome: String(row.total_income ?? "0.00"),
    currency: row.currency,
  }));
}

export async function listIncomeCategories(gymId: string): Promise<IncomeCategoryDto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("income_categories")
    .select("id, code, name, is_membership_related")
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) throw mapSupabaseError(error);

  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    isMembershipRelated: row.is_membership_related,
  }));
}

export async function listIncomeBranches(gymId: string): Promise<IncomeBranchDto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gym_branches")
    .select("id, name")
    .eq("gym_id", gymId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) throw mapSupabaseError(error);
  return data ?? [];
}

export async function recordOtherIncome(input: RecordOtherIncomeInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_other_income" as never, {
    p_gym_id: input.gymId,
    p_income_category_id: input.incomeCategoryId,
    p_amount: input.amount,
    p_currency: input.currency,
    p_branch_id: input.branchId ?? null,
    p_reference: input.reference ?? null,
    p_description: input.description ?? null,
  } as never);

  if (error) throw mapSupabaseError(error);
}

function mapDailyIncome(row: Views<"v_gym_income_daily">): DailyIncomeDto {
  return {
    gymId: row.gym_id,
    incomeDate: row.income_date,
    totalIncome: row.total_income == null ? "0.00" : String(row.total_income),
    currency: row.currency,
  };
}

function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

type MonthlyIncomeRow = {
  gym_id: string;
  income_month: string;
  total_income: string | number | null;
  currency: string;
};

type IncomeViewQuery = {
  select(columns: string): IncomeViewQuery;
  eq(column: string, value: unknown): IncomeViewQuery;
  gte(column: string, value: unknown): IncomeViewQuery;
  lte(column: string, value: unknown): IncomeViewQuery;
  order(column: string, options?: { ascending?: boolean }): IncomeViewQuery;
  limit(value: number): Promise<{ data: MonthlyIncomeRow[] | null; error: unknown }>;
};

type IncomeViewsClient = {
  from(relation: string): IncomeViewQuery;
};
