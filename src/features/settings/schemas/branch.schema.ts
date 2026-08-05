import { z } from "zod";

const optionalText = z.string().trim().transform((value) => value || null);

export const branchSchema = z.object({
  code: z.string().trim().min(2, "Escribe un codigo de al menos 2 caracteres.").max(30).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2, "Escribe el nombre de la sucursal.").max(120),
  city: optionalText,
  status: z.enum(["active", "inactive"]),
});

export const updateBranchSchema = branchSchema.extend({ branchId: z.string().uuid() });
export const retireBranchSchema = z.object({
  branchId: z.string().uuid(),
  reason: z.string().trim().min(3, "Indica el motivo del retiro."),
});
export const restoreBranchSchema = z.object({ branchId: z.string().uuid() });

export type BranchInput = z.infer<typeof branchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
