import { describe, expect, it } from "vitest";

import { parseBooleanFilter } from "./member-filter-query";

describe("member filter query", () => {
  it("preserves true and false overdue selections", () => {
    expect(parseBooleanFilter("true")).toBe(true);
    expect(parseBooleanFilter("false")).toBe(false);
  });

  it("ignores an invalid overdue selection", () => {
    expect(parseBooleanFilter("yes")).toBeUndefined();
  });
});
