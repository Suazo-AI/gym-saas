import { z } from "zod";

const uuid = z.string().uuid();
const employeeCode = z.string().trim().transform((value) => value || null).nullish();
const roleIds = z.array(uuid).min(1, "Selecciona al menos un rol.");

export const inviteStaffSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresa un correo valido."),
  employeeCode,
  roleIds,
});

export const updateStaffSchema = z.object({
  gymId: uuid,
  gymUserId: uuid,
  employeeCode,
  status: z.enum(["invited", "active", "suspended", "revoked"]),
  roleIds,
});

export const deleteStaffSchema = z.object({
  gymUserId: uuid,
  reason: z.string().trim().min(3, "Indica el motivo del retiro."),
});

export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
