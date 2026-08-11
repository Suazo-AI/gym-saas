"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import {
  refundPaymentSchema,
  registerPaymentSchema,
  voidPaymentSchema,
} from "../schemas/payment.schema";
import {
  refundPayment,
  registerMemberPayment,
  voidPayment,
} from "../services/payment.repository";

export type PaymentActionState = { ok: boolean; message?: string };
export async function recordPaymentAction(_: PaymentActionState, form: FormData): Promise<PaymentActionState> {
  try {
    const gym = await getActiveGym();
    if (!gym) return { ok: false, message: "No hay gimnasio activo." };

    const input = registerPaymentSchema.parse({
      gymId: gym.gymId,
      gymMemberId: form.get("gymMemberId"),
      paymentMethodId: form.get("paymentMethodId"),
      amount: form.get("amount"),
      currency: form.get("currency"),
      allocations: [{ chargeId: form.get("chargeId"), amount: form.get("amount") }],
      paidAt: optional(form, "paidAt"),
      notes: optional(form, "notes"),
    });
    const payment = await registerMemberPayment(input);
    refresh();
    revalidatePath(`/members/${input.gymMemberId}`);
    return { ok: true, message: `Pago registrado. Recibo ${payment.receiptNumber}.` };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}
export async function voidPaymentAction(_: PaymentActionState, form: FormData): Promise<PaymentActionState> {
  try { const input=voidPaymentSchema.parse({paymentId:form.get("paymentId"),reason:form.get("reason")}); await voidPayment(input.paymentId,input.reason); refresh(); return {ok:true,message:"Pago anulado. El cargo fue reabierto."}; } catch(e) { return {ok:false,message:message(e)}; }
}

export async function refundPaymentAction(
  _: PaymentActionState,
  form: FormData,
): Promise<PaymentActionState> {
  try {
    const input = refundPaymentSchema.parse({
      paymentId: form.get("paymentId"),
      amount: form.get("amount"),
      reason: form.get("reason"),
    });
    await refundPayment(input.paymentId, input.amount, input.reason);
    refresh();
    return { ok: true, message: "Reembolso registrado. El saldo del cargo fue actualizado." };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}

export async function registerPaymentAction(_: PaymentActionState, form: FormData): Promise<PaymentActionState> {
  let receiptPath: string;
  try {
    const gym = await getActiveGym();
    if (!gym) return { ok: false, message: "No hay gimnasio activo." };

    const chargeIds = form.getAll("allocationChargeId");
    const amounts = form.getAll("allocationAmount");
    const allocations = chargeIds.flatMap((chargeId, index) => {
      const amount = amounts[index];
      return typeof chargeId === "string" && chargeId.trim() && typeof amount === "string" && amount.trim()
        ? [{ chargeId: chargeId.trim(), amount: amount.trim() }]
        : [];
    });
    const gymMemberId = optional(form, "gymMemberId") ?? "";
    const payment = await registerMemberPayment({
      gymId: gym.gymId,
      gymMemberId,
      paymentMethodId: optional(form, "paymentMethodId") ?? "",
      amount: optional(form, "amount") ?? "",
      currency: (optional(form, "currency") ?? "") as "USD" | "NIO",
      allocations,
      branchId: optional(form, "branchId") ?? null,
      paidAt: optional(form, "paidAt") ?? null,
      externalReference: optional(form, "externalReference") ?? null,
      notes: optional(form, "notes") ?? null,
    });
    refresh();
    revalidatePath(`/members/${gymMemberId}`);
    receiptPath = `/payments/${payment.paymentId}/receipt`;
  } catch (error) {
    return { ok: false, message: message(error) };
  }
  redirect(receiptPath);
}
function optional(form:FormData,key:string){const value=form.get(key);return typeof value==="string"&&value.trim()?value.trim():undefined;}
function refresh(){revalidatePath("/payments");revalidatePath("/dashboard");revalidatePath("/members");}
function message(error:unknown){return error instanceof Error?error.message:"No pudimos completar la operación.";}
