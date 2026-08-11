import { describe, expect, it } from "vitest";

import { parseRecoverySessionHash, resolveAuthCallbackPath } from "./auth-callback";

describe("resolveAuthCallbackPath", () => {
  it("rejects absolute external callback destinations", () => {
    expect(resolveAuthCallbackPath("https://example.com/phishing")).toBe("/dashboard");
  });

  it("rejects callback destinations that use backslashes to escape the origin", () => {
    expect(resolveAuthCallbackPath("/\\example.com/phishing")).toBe("/dashboard");
  });

  it("rejects callback destinations that normalize control characters into an external URL", () => {
    expect(resolveAuthCallbackPath("/\t/example.com/phishing")).toBe("/dashboard");
  });

  it("reads a complete implicit recovery session without accepting partial tokens", () => {
    expect(parseRecoverySessionHash("#access_token=access&refresh_token=refresh&type=invite")).toEqual({
      access_token: "access",
      refresh_token: "refresh",
    });
    expect(parseRecoverySessionHash("#access_token=access&refresh_token=refresh&type=recovery")).toEqual({
      access_token: "access",
      refresh_token: "refresh",
    });
    expect(parseRecoverySessionHash("#access_token=access")).toBeNull();
    expect(parseRecoverySessionHash("#access_token=access&refresh_token=refresh")).toBeNull();
    expect(parseRecoverySessionHash("#access_token=access&refresh_token=refresh&type=magiclink")).toBeNull();
  });
});
