"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/api-error";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";

import {
  createMember,
  deleteMember,
  restoreMember,
  updateMember,
} from "../services/member.repository";
import { enrollMemberFaceFromForm } from "../services/member-face-enrollment.service";
import { restoreMemberSchema, retireMemberSchema } from "../schemas/member.schema";

export type MemberActionState = {
  ok: boolean;
  message?: string;
  memberId?: string;
  warning?: string;
};

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function numberOrNull(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createMemberAction(
  _state: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  try {
    const activeGym = await getActiveGym();
    if (!activeGym) return { ok: false, message: "No hay un gimnasio seleccionado." };
    const faceImageBase64 = text(formData, "faceImageBase64");
    const biometricConsentGranted = formData.get("biometricConsentGranted") === "on";

    if (faceImageBase64 && !biometricConsentGranted) {
      return {
        ok: false,
        message: "Para enrolar rostro debes confirmar el consentimiento biometrico.",
      };
    }

    const memberId = await createMember({
      gymId: activeGym.gymId,
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

    if (faceImageBase64) {
      try {
        await enrollMemberFaceFromForm({
          gymId: activeGym.gymId,
          gymMemberId: memberId,
          imageBase64: faceImageBase64,
          biometricConsentGranted,
          widthPixels: numberOrNull(formData, "faceImageWidth"),
          heightPixels: numberOrNull(formData, "faceImageHeight"),
        });
      } catch (error) {
        revalidatePath("/dashboard");
        revalidatePath("/members");
        return {
          ok: true,
          memberId,
          warning: `Miembro creado, pero no se pudo enrolar el rostro: ${publicMessage(error)}`,
        };
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/members");
    return { ok: true, memberId, message: "Miembro creado." };
  } catch (error) {
    return { ok: false, message: publicMessage(error) };
  }
}

export async function updateMemberAction(
  _state: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  try {
    const activeGym = await getActiveGym();
    if (!activeGym) return { ok: false, message: "No hay un gimnasio seleccionado." };
    await updateMember({
      gymId: activeGym.gymId,
      gymMemberId: text(formData, "gymMemberId") ?? "",
      firstName: text(formData, "firstName"),
      lastName: text(formData, "lastName"),
      memberCode: text(formData, "memberCode"),
      branchId: text(formData, "branchId") ?? null,
      phone: editableText(formData, "phone"),
      email: editableText(formData, "email"),
    });
    revalidatePath("/dashboard");
    revalidatePath("/members");
    revalidatePath(`/members/${text(formData, "gymMemberId") ?? ""}`);
    return { ok: true, message: "Miembro actualizado." };
  } catch (error) {
    return { ok: false, message: publicMessage(error) };
  }
}

export async function deleteMemberAction(_state: MemberActionState, formData: FormData): Promise<MemberActionState> {
  try {
    const input = retireMemberSchema.parse({ gymMemberId: formData.get("gymMemberId"), reason: formData.get("reason") });
    await deleteMember(input);
    revalidateMemberPaths(input.gymMemberId);
    return { ok: true, message: "Miembro retirado." };
  } catch (error) {
    return { ok: false, message: publicMessage(error) };
  }
}

function editableText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : undefined;
}

export async function restoreMemberAction(_state: MemberActionState, formData: FormData): Promise<MemberActionState> {
  try {
    const input = restoreMemberSchema.parse({ gymMemberId: formData.get("gymMemberId") });
    await restoreMember(input);
    revalidateMemberPaths(input.gymMemberId);
    return { ok: true, message: "Miembro restaurado." };
  } catch (error) {
    return { ok: false, message: publicMessage(error) };
  }
}

function revalidateMemberPaths(gymMemberId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/members");
  revalidatePath("/members/deleted");
  revalidatePath(`/members/${gymMemberId}`);
}

function publicMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "No pudimos completar la operacion.";
}
