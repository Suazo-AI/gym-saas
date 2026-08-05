import { z } from "zod";

export const assignSubscriptionSchema = z.object({
  gymId: z.string().uuid(),
  gymMemberId: z.string().uuid(),
  membershipPlanId: z.string().uuid(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe ser válida.")
    .optional(),
  billingCycleMonths: z.coerce.number().int().positive().optional(),
  recurringAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "El monto debe ser decimal.")
    .optional(),
  currency: z.enum(["USD", "NIO"]).optional(),
  autoRenew: z.boolean().default(true),
  generateFirstCharge: z.boolean().default(true),
});

export type AssignSubscriptionSchemaInput = z.input<typeof assignSubscriptionSchema>;
