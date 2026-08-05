import { z } from "zod";

const optionalText = z.string().trim().transform((value) => value || null);
const money = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Escribe un monto válido.");
const positiveInteger = z.coerce.number().int().positive("La duración debe ser mayor que cero.");
const nonNegativeInteger = z.coerce.number().int().nonnegative("Los días de gracia no pueden ser negativos.");
const formBoolean = z.preprocess((value) => value === true || value === "true" || value === "on", z.boolean());

export const membershipPlanSchema = z.object({
  code: z.string().trim().min(2, "Escribe un código de al menos 2 caracteres.").max(30).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2, "Escribe el nombre del plan.").max(120),
  description: optionalText,
  price: money,
  currency: z.enum(["USD", "NIO"]),
  durationCount: positiveInteger,
  durationUnit: z.enum(["day", "week", "month"]),
  graceDays: nonNegativeInteger,
  autoRenew: formBoolean,
  isActive: formBoolean,
});

export const updateMembershipPlanSchema = membershipPlanSchema.extend({ planId: z.string().uuid() });
export const retireMembershipPlanSchema = z.object({
  planId: z.string().uuid(),
  reason: z.string().trim().min(3, "Indica el motivo del retiro."),
});
export const restoreMembershipPlanSchema = z.object({ planId: z.string().uuid() });

export const membershipPlanBenefitSchema = z.object({
  planId: z.string().uuid(),
  benefitCode: z.string().trim().min(2, "Escribe el código del beneficio.").max(30).transform((value) => value.toUpperCase()),
  description: z.string().trim().min(2, "Escribe la descripción del beneficio.").max(200),
});
export const retireMembershipPlanBenefitSchema = z.object({
  benefitId: z.string().uuid(),
  reason: z.string().trim().min(3, "Indica el motivo del retiro."),
});

export type MembershipPlanInput = z.infer<typeof membershipPlanSchema>;
export type UpdateMembershipPlanInput = z.infer<typeof updateMembershipPlanSchema>;
export type MembershipPlanBenefitInput = z.infer<typeof membershipPlanBenefitSchema>;
