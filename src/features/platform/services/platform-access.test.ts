import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/features/auth/services/auth.service", () => ({ requireUser: mocks.requireUser }));

import { getPlatformNavigation, hasPlatformAccess, requirePlatformAdmin } from "./platform-access";

describe("platform access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows only the approved global administrator role", () => {
    expect(hasPlatformAccess({ platform_role: "admin" })).toBe(true);
    expect(hasPlatformAccess({ platform_role: "support" })).toBe(false);
    expect(hasPlatformAccess({})).toBe(false);
  });

  it("returns SaaS navigation only to an administrator", () => {
    expect(getPlatformNavigation({})).toEqual([]);
    expect(getPlatformNavigation({ platform_role: "admin" }).map((item) => item.href)).toContain("/platform/audit");
  });

  it("redirects a signed-in user without platform access", async () => {
    mocks.requireUser.mockResolvedValue({ app_metadata: {}, email: "gym@example.com" });
    await requirePlatformAdmin();
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });
});
