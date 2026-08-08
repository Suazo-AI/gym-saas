import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

const membersFiltersSchema = z.object({
  search: optionalText,
  status: optionalText,
  branchId: z.string().uuid().optional(),
  membershipStatus: optionalText,
  hasOverdueCharges: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
});

const paymentsFiltersSchema = z
  .object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  })
  .refine(({ from, to }) => !from || !to || from <= to, {
    message: "La fecha inicial no puede ser posterior a la fecha final.",
  });

export function parseMembersExportFilters(searchParams: URLSearchParams) {
  return membersFiltersSchema.parse({
    search: valueOrUndefined(searchParams, "search"),
    status: valueOrUndefined(searchParams, "status"),
    branchId: valueOrUndefined(searchParams, "branchId"),
    membershipStatus: valueOrUndefined(searchParams, "membershipStatus"),
    hasOverdueCharges: valueOrUndefined(searchParams, "hasOverdueCharges"),
  });
}

export function parsePaymentsExportFilters(searchParams: URLSearchParams) {
  return paymentsFiltersSchema.parse({
    from: valueOrUndefined(searchParams, "from"),
    to: valueOrUndefined(searchParams, "to"),
  });
}

function valueOrUndefined(searchParams: URLSearchParams, name: string) {
  return searchParams.get(name) ?? undefined;
}
