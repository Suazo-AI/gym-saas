import { z } from "zod";

const registerAmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "El monto debe ser decimal.");

function decimalToCents(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction.padEnd(2, "0"), 10);
}

export const registerPaymentSchema = z
  .object({
    gymId: z.string().uuid(),
    gymMemberId: z.string().uuid(),
    paymentMethodId: z.string().uuid(),
    amount: registerAmountSchema,
    currency: z.enum(["USD", "NIO"]),
    allocations: z
      .array(z.object({ chargeId: z.string().uuid(), amount: registerAmountSchema }))
      .min(1),
    branchId: z.string().uuid().nullish(),
    paidAt: z.string().datetime().nullish(),
    externalReference: z.string().trim().nullish(),
    notes: z.string().trim().nullish(),
  })
  .refine(
    (input) =>
      input.allocations.reduce(
        (total, allocation) => total + decimalToCents(allocation.amount),
        0,
      ) === decimalToCents(input.amount),
    {
      message: "El total asignado no coincide con el monto del pago.",
      path: ["allocations"],
    },
  );
export const voidPaymentSchema = z.object({ paymentId: z.string().uuid(), reason: z.string().trim().min(3, "Indica el motivo de anulación.") });

export const refundPaymentSchema = z.object({
  paymentId: z.string().uuid(),
  amount: registerAmountSchema.refine(
    (value) => decimalToCents(value) > 0,
    "El monto debe ser mayor que cero.",
  ),
  reason: z.string().trim().min(3, "Indica el motivo del reembolso."),
});
