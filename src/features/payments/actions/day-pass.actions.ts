"use server";

import { revalidatePath } from "next/cache";

import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { registerMemberDayPass } from "../services/payment.repository";

export type DayPassActionState = { ok: boolean; message?: string };

export async function registerDayPassAction(_: DayPassActionState, form: FormData): Promise<DayPassActionState> {
  try {
    const gym = await getActiveGym();
    if (!gym) return { ok: false, message: "No hay gimnasio activo." };
    const memberId = text(form, "gymMemberId") ?? "";
    const result = await registerMemberDayPass({
      gymId: gym.gymId,
      gymMemberId: memberId,
      paymentMethodId: text(form, "paymentMethodId") ?? "",
      serviceDate: text(form, "serviceDate") ?? "",
      amount: text(form, "amount") ?? "",
      currency: (text(form, "currency") ?? "") as "USD" | "NIO",
      branchId: text(form, "branchId") ?? null,
      notes: text(form, "notes") ?? null,
    });
    revalidatePath("/payments");
    revalidatePath(`/payments/day-pass?gymMemberId=${memberId}`);
    revalidatePath("/entries");
    return { ok: true, message: `Pase registrado para ${result.serviceDate}. Recibo ${result.receiptNumber}.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No pudimos registrar el pase." };
  }
}

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
