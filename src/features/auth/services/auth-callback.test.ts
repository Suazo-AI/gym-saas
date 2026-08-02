import { describe, expect, it } from "vitest";

import { resolveAuthCallbackPath } from "./auth-callback";

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
});
