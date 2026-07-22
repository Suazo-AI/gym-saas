import { describe, expect, it } from "vitest";

import { listMembersSchema } from "./member.schema";

describe("listMembersSchema", () => {
  it("trims search and applies pagination defaults", () => {
    const parsed = listMembersSchema.parse({
      gymId: "11111111-1111-4111-8111-111111111111",
      search: "  Ana  ",
    });

    expect(parsed.search).toBe("Ana");
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.orderBy).toBe("createdAt");
    expect(parsed.orderDirection).toBe("desc");
  });

  it("rejects page sizes above 100", () => {
    expect(() =>
      listMembersSchema.parse({
        gymId: "11111111-1111-4111-8111-111111111111",
        pageSize: 101,
      }),
    ).toThrow();
  });
});
