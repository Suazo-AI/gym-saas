import { z } from "zod";

export const recordOtherIncomeSchema = z.object({
  gymId: z.string().uuid(),
  incomeCategoryId: z.string().uuid("Selecciona una categoría."),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "El monto debe tener máximo dos decimales."),
  currency: z.enum(["NIO", "USD"]),
  branchId: z.string().uuid().nullish(),
  reference: z.string().trim().max(120, "La referencia es demasiado larga.").nullish(),
  description: z.string().trim().max(500, "La descripción es demasiado larga.").nullish(),
});
