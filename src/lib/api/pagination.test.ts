import { describe, expect, it } from "vitest";

import { createPagination, normalizePaginationInput } from "./pagination";

describe("pagination", () => {
  it("normalizes invalid input to safe defaults", () => {
    expect(normalizePaginationInput({ page: 0, pageSize: 500 })).toEqual({
      page: 1,
      pageSize: 100,
      from: 0,
      to: 99,
    });
  });

  it("creates deterministic pagination metadata", () => {
    expect(createPagination({ page: 2, pageSize: 20, total: 45 })).toEqual({
      page: 2,
      pageSize: 20,
      total: 45,
      pageCount: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });
});
