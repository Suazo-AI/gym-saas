import { z } from "zod";

export const recordPaymentSchema = z.object({
  gymId: z.string().uuid(), chargeId: z.string().uuid(), paymentMethodId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Monto inválido."), currency: z.enum(["USD", "NIO"]),
  paidAt: z.string().datetime().optional(), notes: z.string().trim().max(500).optional(),
});
export const voidPaymentSchema = z.object({ paymentId: z.string().uuid(), reason: z.string().trim().min(3, "Indica el motivo de anulación.") });
