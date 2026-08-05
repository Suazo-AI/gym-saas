import { describe, expect, it } from "vitest";

import { buildSearchHref } from "./persisted-search-form";

describe("buildSearchHref", () => {
  it("preserves existing filters and resets pagination", () => {
    expect(buildSearchHref("/members", "status=active&page=3", "search", " Ana ")).toBe("/members?status=active&search=Ana");
  });

  it("removes an empty search term", () => {
    expect(buildSearchHref("/entries", "search=Ana&gymMemberId=abc", "search", "")).toBe("/entries?gymMemberId=abc");
  });
});
