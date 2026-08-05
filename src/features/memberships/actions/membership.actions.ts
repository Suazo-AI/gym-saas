"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/api-error";

import { assignMemberSubscription } from "../services/membership.repository";

type MembershipActionState = {
  ok: boolean;
  message?: string;
  subscriptionId?: string;
};

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

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

function publicMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "No pudimos completar la operacion.";
}
