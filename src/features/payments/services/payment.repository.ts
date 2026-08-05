import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

import { recordPaymentSchema } from "../schemas/payment.schema";
import { registerPaymentSchema } from "../schemas/payment.schema";
import { mapPendingChargeRows, mapRegisteredPayment } from "../mappers/payment.mapper";
import type {
  PayableChargeDto, PaymentMethodDto, PaymentSummaryDto, PendingChargeDto,
  PendingChargeRow, RegisteredPaymentDto, RegisteredPaymentRow, RegisterPaymentInput,
} from "../types/payment.dto";

type PendingChargeQuery = {
  select: (columns: string) => PendingChargeQuery;
  eq: (column: string, value: unknown) => PendingChargeQuery;
  order: (column: string, options?: { ascending?: boolean }) => Promise<{ data: PendingChargeRow[] | null; error: unknown }>;
};
type PendingChargesClient = { from: (relation: string) => PendingChargeQuery };

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
    .select("id, gym_member_id, amount, currency, status, receipt_number, paid_at, applied_nio_per_usd")
    .eq("gym_id", gymId)
    .order("paid_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));

  if (error) {
    throw mapSupabaseError(error);
  }

  return (data ?? []).map(mapPayment);
}

export async function listMemberPendingCharges(input: {
  gymId: string;
  gymMemberId: string;
}): Promise<PendingChargeDto[]> {
  const supabase = (await createClient()) as unknown as PendingChargesClient;
  const { data, error } = await supabase
    .from("api_v1_member_pending_charges")
    .select("*")
    .eq("gym_id", input.gymId)
    .eq("gym_member_id", input.gymMemberId)
    .order("due_date", { ascending: true });

  if (error) {
    throw mapSupabaseError(error);
  }

  return mapPendingChargeRows(data ?? []);
}

export async function registerMemberPayment(
  input: RegisterPaymentInput,
): Promise<RegisteredPaymentDto> {
  const parsed = registerPaymentSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_member_payment" as never, {
    p_gym_id: parsed.gymId,
    p_gym_member_id: parsed.gymMemberId,
    p_payment_method_id: parsed.paymentMethodId,
    p_amount: parsed.amount,
    p_currency: parsed.currency,
    p_allocations: parsed.allocations.map((allocation) => ({
      chargeId: allocation.chargeId,
      amount: allocation.amount,
    })),
    p_branch_id: parsed.branchId ?? null,
    p_paid_at: parsed.paidAt ?? null,
    p_external_reference: parsed.externalReference ?? null,
    p_notes: parsed.notes ?? null,
  } as never);

  if (error) {
    throw mapSupabaseError(error);
  }

  return mapRegisteredPayment(data as unknown as RegisteredPaymentRow);
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
    appliedNioPerUsd: String((row as unknown as { applied_nio_per_usd: string | number }).applied_nio_per_usd),
  };
}

export async function listPayableCharges(gymId: string): Promise<PayableChargeDto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_payable_member_charges" as never, { p_gym_id: gymId } as never);
  if (error) throw mapSupabaseError(error);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({ chargeId: String(row.charge_id), gymMemberId: String(row.gym_member_id), memberLabel: String(row.member_label), dueDate: String(row.due_date), amountDue: String(row.amount_due), currency: String(row.currency), status: String(row.status) }));
}

export async function recordPayment(input: unknown) {
  const parsed = recordPaymentSchema.parse(input); const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_member_payment" as never, { p_gym_id: parsed.gymId, p_charge_id: parsed.chargeId, p_payment_method_id: parsed.paymentMethodId, p_amount: parsed.amount, p_currency: parsed.currency, p_paid_at: parsed.paidAt ?? null, p_notes: parsed.notes ?? null } as never);
  if (error) throw mapSupabaseError(error); return data;
}

export async function voidPayment(paymentId: string, reason: string) {
  const supabase = await createClient(); const { data, error } = await supabase.rpc("void_member_payment" as never, { p_payment_id: paymentId, p_reason: reason } as never);
  if (error) throw mapSupabaseError(error); return data;
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
