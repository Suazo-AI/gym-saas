"use server";
import { revalidatePath } from "next/cache";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { recordPaymentSchema, voidPaymentSchema } from "../schemas/payment.schema";
import { recordPayment, registerMemberPayment, voidPayment } from "../services/payment.repository";

export type PaymentActionState = { ok: boolean; message?: string };
export async function recordPaymentAction(_: PaymentActionState, form: FormData): Promise<PaymentActionState> {
  try { const gym=await getActiveGym(); if(!gym) return {ok:false,message:"No hay gimnasio activo."}; const input=recordPaymentSchema.parse({gymId:gym.gymId,chargeId:form.get("chargeId"),paymentMethodId:form.get("paymentMethodId"),amount:form.get("amount"),currency:form.get("currency"),paidAt:optional(form,"paidAt"),notes:optional(form,"notes")}); await recordPayment(input); refresh(); return {ok:true,message:"Pago registrado y recibo generado."}; } catch(e) { return {ok:false,message:message(e)}; }
}
export async function voidPaymentAction(_: PaymentActionState, form: FormData): Promise<PaymentActionState> {
  try { const input=voidPaymentSchema.parse({paymentId:form.get("paymentId"),reason:form.get("reason")}); await voidPayment(input.paymentId,input.reason); refresh(); return {ok:true,message:"Pago anulado. El cargo fue reabierto."}; } catch(e) { return {ok:false,message:message(e)}; }
}

export async function registerPaymentAction(_: PaymentActionState, form: FormData): Promise<PaymentActionState> {
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
    return { ok: true, message: `Pago registrado. Recibo ${payment.receiptNumber}.` };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}
function optional(form:FormData,key:string){const value=form.get(key);return typeof value==="string"&&value.trim()?value.trim():undefined;}
function refresh(){revalidatePath("/payments");revalidatePath("/dashboard");revalidatePath("/members");}
function message(error:unknown){return error instanceof Error?error.message:"No pudimos completar la operación.";}
