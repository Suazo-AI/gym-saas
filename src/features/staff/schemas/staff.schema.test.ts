import { describe, expect, it } from "vitest";

import { inviteStaffSchema, updateStaffSchema } from "./staff.schema";

const gymId = "20000000-0000-4000-8000-000000000001";
const staffId = "30000000-0000-4000-8000-000000000001";
const roleId = "40000000-0000-4000-8000-000000000001";

describe("staff schemas", () => {
  it("normalizes a valid invitation", () => {
    expect(inviteStaffSchema.parse({
      email: " RECEPCION@GYM.COM ",
      employeeCode: " R-01 ",
      roleIds: [roleId],
    })).toEqual({
      email: "recepcion@gym.com",
      employeeCode: "R-01",
      roleIds: [roleId],
    });
  });

  it("requires at least one invitation role", () => {
    expect(() => inviteStaffSchema.parse({ email: "a@gym.com", roleIds: [] })).toThrow();
  });

  it("accepts only supported staff lifecycle states", () => {
    expect(updateStaffSchema.parse({
      gymId,
      gymUserId: staffId,
      status: "suspended",
      employeeCode: "",
      roleIds: [roleId],
    })).toMatchObject({ status: "suspended", employeeCode: null });

    expect(() => updateStaffSchema.parse({
      gymId,
      gymUserId: staffId,
      status: "deleted",
      roleIds: [roleId],
    })).toThrow();
  });
});
