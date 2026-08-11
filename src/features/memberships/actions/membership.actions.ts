"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/api-error";

import { assignMemberSubscription, cancelMemberSubscription } from "../services/membership.repository";

export type MembershipActionState = {
  ok: boolean;
  message?: string;
  subscriptionId?: string;
};

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

const cancelMembershipSchema = z.object({
  gymMemberId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  reason: z.string().trim().min(3, "Indica el motivo de la cancelación."),
  cancelAtPeriodEnd: z.boolean(),
});

export async function assignMembershipAction(
  _state: MembershipActionState,
  formData: FormData,
): Promise<MembershipActionState> {
  try {
    const gymMemberId = text(formData, "gymMemberId") ?? "";
    const subscription = await assignMemberSubscription({
      gymId: text(formData, "gymId") ?? "",
      gymMemberId,
      membershipPlanId: text(formData, "membershipPlanId") ?? "",
      startDate: text(formData, "startDate"),
      generateFirstCharge: formData.get("generateFirstCharge") === "on",
    });

    revalidatePath("/members");
    revalidatePath(`/members/${gymMemberId}`);
    revalidatePath("/dashboard");
    revalidatePath("/memberships");

    return {
      ok: true,
      message: "Membresía asignada.",
      subscriptionId: subscription.subscriptionId,
    };
  } catch (error) {
    return { ok: false, message: publicMessage(error) };
  }
}

export async function cancelMembershipAction(
  _state: MembershipActionState,
  formData: FormData,
): Promise<MembershipActionState> {
  try {
    const input = cancelMembershipSchema.parse({
      gymMemberId: formData.get("gymMemberId"),
      subscriptionId: formData.get("subscriptionId"),
      reason: formData.get("reason"),
      cancelAtPeriodEnd: formData.get("cancelAtPeriodEnd") === "on",
    });
    await cancelMemberSubscription(input);
    revalidatePath("/members");
    revalidatePath(`/members/${input.gymMemberId}`);
    revalidatePath("/dashboard");
    return { ok: true, message: input.cancelAtPeriodEnd ? "Cancelación programada." : "Membresía cancelada." };
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
