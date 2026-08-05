"use server";
import { revalidatePath } from "next/cache";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { recordPaymentSchema, voidPaymentSchema } from "../schemas/payment.schema";
import { recordPayment, voidPayment } from "../services/payment.repository";

export type PaymentActionState = { ok: boolean; message?: string };
export async function recordPaymentAction(_: PaymentActionState, form: FormData): Promise<PaymentActionState> {
  try { const gym=await getActiveGym(); if(!gym) return {ok:false,message:"No hay gimnasio activo."}; const input=recordPaymentSchema.parse({gymId:gym.gymId,chargeId:form.get("chargeId"),paymentMethodId:form.get("paymentMethodId"),amount:form.get("amount"),currency:form.get("currency"),paidAt:optional(form,"paidAt"),notes:optional(form,"notes")}); await recordPayment(input); refresh(); return {ok:true,message:"Pago registrado y recibo generado."}; } catch(e) { return {ok:false,message:message(e)}; }
}
export async function voidPaymentAction(_: PaymentActionState, form: FormData): Promise<PaymentActionState> {
  try { const input=voidPaymentSchema.parse({paymentId:form.get("paymentId"),reason:form.get("reason")}); await voidPayment(input.paymentId,input.reason); refresh(); return {ok:true,message:"Pago anulado. El cargo fue reabierto."}; } catch(e) { return {ok:false,message:message(e)}; }
}
function optional(form:FormData,key:string){const value=form.get(key);return typeof value==="string"&&value.trim()?value.trim():undefined;}
function refresh(){revalidatePath("/payments");revalidatePath("/dashboard");revalidatePath("/members");}
function message(error:unknown){return error instanceof Error?error.message:"No pudimos completar la operación.";}
