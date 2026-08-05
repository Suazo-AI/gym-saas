"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/api-error";

import { registerMemberPayment } from "../services/payment.repository";

type PaymentActionState = {
  ok: boolean;
  message?: string;
  paymentId?: string;
  receiptNumber?: string;
};

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export async function registerPaymentAction(
  _state: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  try {
    const chargeIds = formData.getAll("allocationChargeId");
    const amounts = formData.getAll("allocationAmount");
    const allocations = chargeIds.flatMap((chargeId, index) => {
      const amount = amounts[index];
      if (
        typeof chargeId !== "string" ||
        chargeId.trim() === "" ||
        typeof amount !== "string" ||
        amount.trim() === ""
      ) {
        return [];
      }

      return [{ chargeId: chargeId.trim(), amount: amount.trim() }];
    });
    const gymMemberId = text(formData, "gymMemberId") ?? "";
    const payment = await registerMemberPayment({
      gymId: text(formData, "gymId") ?? "",
      gymMemberId,
      paymentMethodId: text(formData, "paymentMethodId") ?? "",
      amount: text(formData, "amount") ?? "",
      currency: (text(formData, "currency") ?? "") as "USD" | "NIO",
      allocations,
      branchId: text(formData, "branchId") ?? null,
      paidAt: text(formData, "paidAt") ?? null,
      externalReference: text(formData, "externalReference") ?? null,
      notes: text(formData, "notes") ?? null,
    });

    revalidatePath("/payments");
    revalidatePath("/members");
    revalidatePath(`/members/${gymMemberId}`);
    revalidatePath("/dashboard");

    return {
      ok: true,
      message: `Pago registrado. Recibo ${payment.receiptNumber}.`,
      paymentId: payment.paymentId,
      receiptNumber: payment.receiptNumber,
    };
  } catch (error) {
    return { ok: false, message: publicMessage(error) };
  }
}

function publicMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "No pudimos completar la operacion.";
}
