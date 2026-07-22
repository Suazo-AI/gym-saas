import { z } from "zod";

const uuidSchema = z.string().uuid();
const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

export const listMembersSchema = z.object({
  gymId: uuidSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: optionalTrimmedString,
  status: optionalTrimmedString,
  branchId: uuidSchema.optional(),
  membershipStatus: optionalTrimmedString,
  hasOverdueCharges: z.coerce.boolean().optional(),
  orderBy: z.enum(["createdAt", "fullName", "memberCode", "nextPaymentDate"]).default("createdAt"),
  orderDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const createMemberSchema = z.object({
  gymId: uuidSchema,
  firstName: z.string().trim().min(1, "El nombre es obligatorio."),
  lastName: z.string().trim().min(1, "El apellido es obligatorio."),
  memberCode: optionalTrimmedString,
  branchId: uuidSchema.nullish(),
  phone: optionalTrimmedString,
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  joinedOn: z.string().date().optional(),
  membershipPlanId: uuidSchema.nullish(),
  subscriptionStartDate: z.string().date().nullish(),
  createInitialCharge: z.coerce.boolean().optional(),
  paymentMethodId: uuidSchema.nullish(),
  paymentAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "El monto debe ser decimal.")
    .nullish(),
  paymentCurrency: z.enum(["USD", "NIO"]).nullish(),
  paymentPaidAt: z.string().datetime().nullish(),
  paymentNotes: optionalTrimmedString.nullish(),
});

export const updateMemberSchema = createMemberSchema.partial().extend({
  gymId: uuidSchema,
  gymMemberId: uuidSchema,
});

export type ListMembersSchemaInput = z.infer<typeof listMembersSchema>;
export type CreateMemberSchemaInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberSchemaInput = z.infer<typeof updateMemberSchema>;
