import { z } from "zod";

const uuidSchema = z.string().uuid();
const amountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "El monto debe ser decimal.");
const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .nullish();

function decimalToCents(value: string): number {
  const [whole, fraction = ""] = value.split(".");
  return parseInt(whole, 10) * 100 + parseInt(fraction.padEnd(2, "0"), 10);
}

export const registerPaymentSchema = z
  .object({
    gymId: uuidSchema,
    gymMemberId: uuidSchema,
    paymentMethodId: uuidSchema,
    amount: amountSchema,
    currency: z.enum(["USD", "NIO"]),
    allocations: z
      .array(
        z.object({
          chargeId: uuidSchema,
          amount: amountSchema,
        }),
      )
      .min(1, "Selecciona al menos un cargo."),
    branchId: uuidSchema.nullish(),
    paidAt: z.string().datetime().nullish(),
    externalReference: optionalTrimmedString,
    notes: optionalTrimmedString,
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
