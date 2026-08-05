"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { ApiError } from "@/lib/api/api-error";
import {
  membershipPlanSchema,
  membershipPlanBenefitSchema,
  retireMembershipPlanBenefitSchema,
  restoreMembershipPlanSchema,
  retireMembershipPlanSchema,
  updateMembershipPlanSchema,
} from "../schemas/membership-plan.schema";
import {
  createMembershipPlan,
  createMembershipPlanBenefit,
  restoreMembershipPlan,
  retireMembershipPlan,
  updateMembershipPlan,
  retireMembershipPlanBenefit,
} from "../services/membership.repository";

export type MembershipPlanActionState = { ok: boolean; message?: string };

export async function createMembershipPlanAction(_: MembershipPlanActionState, formData: FormData) {
  return run(async (gymId) => {
    const input = membershipPlanSchema.parse(fields(formData));
    await createMembershipPlan({ gymId, ...input });
    return "Plan creado.";
  });
}

export async function updateMembershipPlanAction(_: MembershipPlanActionState, formData: FormData) {
  return run(async (gymId) => {
    const input = updateMembershipPlanSchema.parse({ planId: formData.get("planId"), ...fields(formData) });
    await updateMembershipPlan({ gymId, ...input });
    return "Cambios guardados.";
  });
}

export async function retireMembershipPlanAction(_: MembershipPlanActionState, formData: FormData) {
  return run(async () => {
    const input = retireMembershipPlanSchema.parse({ planId: formData.get("planId"), reason: formData.get("reason") });
    await retireMembershipPlan(input);
    return "Plan retirado.";
  });
}

export async function restoreMembershipPlanAction(_: MembershipPlanActionState, formData: FormData) {
  return run(async () => {
    const { planId } = restoreMembershipPlanSchema.parse({ planId: formData.get("planId") });
    await restoreMembershipPlan(planId);
    return "Plan restaurado.";
  });
}

export async function createMembershipPlanBenefitAction(_: MembershipPlanActionState, formData: FormData) {
  return run(async (gymId) => {
    const input = membershipPlanBenefitSchema.parse({ planId: formData.get("planId"), benefitCode: formData.get("benefitCode"), description: formData.get("description") });
    await createMembershipPlanBenefit({ gymId, ...input });
    return "Beneficio agregado.";
  });
}

export async function retireMembershipPlanBenefitAction(_: MembershipPlanActionState, formData: FormData) {
  return run(async () => {
    const input = retireMembershipPlanBenefitSchema.parse({ benefitId: formData.get("benefitId"), reason: formData.get("reason") });
    await retireMembershipPlanBenefit(input);
    return "Beneficio retirado.";
  });
}

function fields(formData: FormData) {
  return {
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    currency: formData.get("currency"),
    durationCount: formData.get("durationCount"),
    durationUnit: formData.get("durationUnit"),
    graceDays: formData.get("graceDays"),
    autoRenew: formData.get("autoRenew"),
    isActive: formData.get("isActive"),
  };
}

async function run(operation: (gymId: string) => Promise<string>): Promise<MembershipPlanActionState> {
  try {
    const activeGym = await getActiveGym();
    if (!activeGym) return { ok: false, message: "No hay un gimnasio seleccionado." };
    const message = await operation(activeGym.gymId);
    revalidatePath("/memberships");
    return { ok: true, message };
  } catch (error) {
    if (error instanceof ZodError) return { ok: false, message: error.issues[0]?.message ?? "Revisa los datos ingresados." };
    if (error instanceof ApiError) {
      if (error.code === "CONFLICT") return { ok: false, message: "Ya existe un plan activo con ese código." };
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "No pudimos completar la acción." };
  }
}
