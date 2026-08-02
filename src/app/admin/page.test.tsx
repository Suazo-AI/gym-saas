import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect }));

import AdminPage from "./page";

describe("legacy /admin route", () => {
  beforeEach(() => {
    redirect.mockClear();
  });

  it("redirects to the protected platform surface", () => {
    AdminPage();

    expect(redirect).toHaveBeenCalledWith("/platform");
  });
});
