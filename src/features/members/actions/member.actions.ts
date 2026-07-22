"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/api-error";

import {
  createMember,
  deleteMember,
  restoreMember,
  updateMember,
} from "../services/member.repository";

type MemberActionState = {
  ok: boolean;
  message?: string;
};

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export async function createMemberAction(
  _state: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  try {
    await createMember({
      gymId: text(formData, "gymId") ?? "",
      firstName: text(formData, "firstName") ?? "",
      lastName: text(formData, "lastName") ?? "",
      memberCode: text(formData, "memberCode"),
      branchId: text(formData, "branchId") ?? null,
      phone: text(formData, "phone"),
      email: text(formData, "email"),
      membershipPlanId: text(formData, "membershipPlanId") ?? null,
      createInitialCharge: formData.get("createInitialCharge") === "on",
      paymentMethodId: text(formData, "paymentMethodId") ?? null,
      paymentAmount: text(formData, "paymentAmount") ?? null,
      paymentCurrency: text(formData, "paymentCurrency") ?? null,
      paymentPaidAt: text(formData, "paymentPaidAt") ?? null,
      paymentNotes: text(formData, "paymentNotes") ?? null,
    });
    revalidatePath("/dashboard");
    return { ok: true, message: "Miembro creado." };
  } catch (error) {
    return { ok: false, message: publicMessage(error) };
  }
}

export async function updateMemberAction(
  _state: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  try {
    await updateMember({
      gymId: text(formData, "gymId") ?? "",
      gymMemberId: text(formData, "gymMemberId") ?? "",
      firstName: text(formData, "firstName"),
      lastName: text(formData, "lastName"),
      memberCode: text(formData, "memberCode"),
      branchId: text(formData, "branchId") ?? null,
      phone: text(formData, "phone"),
      email: text(formData, "email"),
    });
    revalidatePath("/dashboard");
    return { ok: true, message: "Miembro actualizado." };
  } catch (error) {
    return { ok: false, message: publicMessage(error) };
  }
}

export async function deleteMemberAction(formData: FormData) {
  await deleteMember({
    gymMemberId: text(formData, "gymMemberId") ?? "",
    reason: text(formData, "reason"),
  });
  revalidatePath("/dashboard");
}

export async function restoreMemberAction(formData: FormData) {
  await restoreMember({
    gymMemberId: text(formData, "gymMemberId") ?? "",
  });
  revalidatePath("/dashboard");
}

function publicMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "No pudimos completar la operacion.";
}
