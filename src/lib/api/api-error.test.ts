import { describe, expect, it } from "vitest";

import { ApiError, isApiError } from "./api-error";
import { mapSupabaseError } from "./map-supabase-error";

describe("ApiError", () => {
  it("stores a public message without leaking internal details", () => {
    const error = new ApiError("FORBIDDEN", "No tienes permiso.", {
      internalMessage: 'permission denied for table "audit_logs"',
    });

    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toBe("No tienes permiso.");
    expect(error.internalMessage).toContain("audit_logs");
    expect(isApiError(error)).toBe(true);
  });

  it("maps PostgreSQL unique violations to conflict errors", () => {
    const error = mapSupabaseError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "gym_members_gym_id_member_code_key"',
      details: "Key already exists.",
      hint: null,
    });

    expect(error.code).toBe("CONFLICT");
    expect(error.message).toBe("El registro ya existe.");
    expect(error.internalMessage).toContain("duplicate key");
  });
});
