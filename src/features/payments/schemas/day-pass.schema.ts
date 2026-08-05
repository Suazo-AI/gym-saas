import { z } from "zod";

const uuid = z.string().uuid();
const amount = z.string().regex(/^\d+(\.\d{1,2})?$/, "El monto debe ser decimal.");

export const registerDayPassSchema = z.object({
  gymId: uuid,
  gymMemberId: uuid,
  paymentMethodId: uuid,
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indica una fecha válida."),
  amount,
  currency: z.enum(["USD", "NIO"]),
  branchId: uuid.nullish(),
  paidAt: z.string().datetime().nullish(),
  notes: z.string().trim().max(500).nullish(),
});

export type RegisterDayPassInput = z.infer<typeof registerDayPassSchema>;
