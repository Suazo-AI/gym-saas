import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

import type { PaymentMethodDto, PaymentSummaryDto } from "../types/payment.dto";

export async function listPaymentMethods(): Promise<PaymentMethodDto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, code, name, is_cash")
    .eq("is_active", true)
    .order("is_cash", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    throw mapSupabaseError(error);
  }

  return (data ?? []).map(mapPaymentMethod);
}

export async function listRecentPayments(gymId: string, limit = 20): Promise<PaymentSummaryDto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_payments")
    .select("id, gym_member_id, amount, currency, status, receipt_number, paid_at")
    .eq("gym_id", gymId)
    .order("paid_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));

  if (error) {
    throw mapSupabaseError(error);
  }

  return (data ?? []).map(mapPayment);
}

function mapPayment(row: Pick<
  Tables<"member_payments">,
  "id" | "gym_member_id" | "amount" | "currency" | "status" | "receipt_number" | "paid_at"
>): PaymentSummaryDto {
  return {
    id: row.id,
    gymMemberId: row.gym_member_id,
    amount: String(row.amount),
    currency: row.currency,
    status: row.status,
    receiptNumber: row.receipt_number,
    paidAt: row.paid_at,
  };
}

function mapPaymentMethod(row: Pick<
  Tables<"payment_methods">,
  "id" | "code" | "name" | "is_cash"
>): PaymentMethodDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isCash: row.is_cash,
  };
}
