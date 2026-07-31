import { z } from "zod";

const uuidSchema = z.string().uuid("Selecciona un registro válido.");

export const registerEntrySchema = z.object({
  gymId: uuidSchema,
  gymMemberId: uuidSchema,
  branchId: uuidSchema.nullish(),
  overrideReason: z
    .string()
    .trim()
    .max(500, "El motivo no puede superar 500 caracteres.")
    .transform((value) => (value.length > 0 ? value : null))
    .nullish(),
});

export type RegisterEntrySchemaInput = z.infer<typeof registerEntrySchema>;
