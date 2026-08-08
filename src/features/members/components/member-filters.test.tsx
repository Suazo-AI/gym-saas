import { describe, expect, it } from "vitest";

import { buildMemberFiltersHref } from "./member-filters";

describe("buildMemberFiltersHref", () => {
  it("preserves search while applying all member filters", () => {
    expect(buildMemberFiltersHref("/members", "search=Ana&page=4", {
      status: "active",
      membershipStatus: "past_due",
      hasOverdueCharges: "true",
    })).toBe("/members?search=Ana&status=active&membershipStatus=past_due&hasOverdueCharges=true");
  });

  it("removes cleared filters and resets pagination", () => {
    expect(buildMemberFiltersHref("/members", "search=Ana&status=active&membershipStatus=past_due&hasOverdueCharges=false&page=2", {
      status: "",
      membershipStatus: "",
      hasOverdueCharges: "",
    })).toBe("/members?search=Ana");
  });
});
