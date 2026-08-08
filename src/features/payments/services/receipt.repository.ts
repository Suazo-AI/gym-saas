import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";

export type PaymentReceiptDto = {
  id: string;
  gymMemberId: string;
  amount: string;
  currency: string;
  status: string;
  receiptNumber: string | null;
  paidAt: string;
  appliedNioPerUsd: string;
  member: {
    fullName: string | null;
    memberCode: string | null;
  };
  paymentMethod: {
    id: string;
    code: string;
    name: string;
  } | null;
};

export async function getPaymentReceipt(input: {
  gymId: string;
  paymentId: string;
}): Promise<PaymentReceiptDto | null> {
  const supabase = await createClient();
  const { data: payment, error: paymentError } = await supabase
    .from("member_payments")
    .select(
      "id, gym_member_id, payment_method_id, amount, currency, status, receipt_number, paid_at, applied_nio_per_usd",
    )
    .eq("gym_id", input.gymId)
    .eq("id", input.paymentId)
    .maybeSingle();

  if (paymentError) {
    throw mapSupabaseError(paymentError);
  }

  if (!payment) {
    return null;
  }

  const [memberResult, methodResult] = await Promise.all([
    supabase
      .from("api_v1_member_summaries")
      .select("full_name, member_code")
      .eq("gym_id", input.gymId)
      .eq("gym_member_id", payment.gym_member_id)
      .maybeSingle(),
    supabase
      .from("payment_methods")
      .select("id, code, name")
      .eq("id", payment.payment_method_id)
      .maybeSingle(),
  ]);

  if (memberResult.error) {
    throw mapSupabaseError(memberResult.error);
  }

  if (methodResult.error) {
    throw mapSupabaseError(methodResult.error);
  }

  return {
    id: payment.id,
    gymMemberId: payment.gym_member_id,
    amount: String(payment.amount),
    currency: payment.currency,
    status: payment.status,
    receiptNumber: payment.receipt_number,
    paidAt: payment.paid_at,
    appliedNioPerUsd: String(payment.applied_nio_per_usd),
    member: {
      fullName: memberResult.data?.full_name ?? null,
      memberCode: memberResult.data?.member_code ?? null,
    },
    paymentMethod: methodResult.data
      ? {
          id: methodResult.data.id,
          code: methodResult.data.code,
          name: methodResult.data.name,
        }
      : null,
  };
}
