import { describe, expect, it } from "vitest";

import { registerEntrySchema } from "./entry.schema";

describe("registerEntrySchema", () => {
  const validInput = {
    gymId: "20000000-0000-4000-8000-000000000001",
    gymMemberId: "60000000-0000-4000-8000-000000000001",
  };

  it("accepts a member entry and normalizes an empty override reason", () => {
    expect(registerEntrySchema.parse({
      ...validInput,
      overrideReason: "   ",
    })).toEqual({
      ...validInput,
      overrideReason: null,
    });
  });

  it("rejects malformed identifiers with a Spanish message", () => {
    const result = registerEntrySchema.safeParse({
      ...validInput,
      gymMemberId: "member-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Selecciona un registro válido.");
    }
  });

  it("trims an override reason", () => {
    expect(registerEntrySchema.parse({
      ...validInput,
      overrideReason: "  Autorizado por gerencia  ",
    }).overrideReason).toBe("Autorizado por gerencia");
  });
});
