import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";
import type { Views } from "@/lib/supabase/types";

import type { DailyIncomeDto } from "../types/income.dto";

export async function listDailyIncome(gymId: string, limit = 30): Promise<DailyIncomeDto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_gym_income_daily")
    .select("gym_id, income_date, total_income, currency")
    .eq("gym_id", gymId)
    .order("income_date", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));

  if (error) {
    throw mapSupabaseError(error);
  }

  return (data ?? []).map(mapDailyIncome);
}

function mapDailyIncome(row: Views<"v_gym_income_daily">): DailyIncomeDto {
  return {
    gymId: row.gym_id,
    incomeDate: row.income_date,
    totalIncome: row.total_income == null ? "0.00" : String(row.total_income),
    currency: row.currency,
  };
}
