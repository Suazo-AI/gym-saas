import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AppShell theme contrast", () => {
  it("uses a dedicated navbar background instead of the text ink token", () => {
    const source = readFileSync("src/features/app/components/app-shell.tsx", "utf8");
    expect(source).toContain("bg-[#111814]");
    expect(source).not.toContain('aside className="border-b border-white/10 bg-ink');
    expect(source).toContain('font-bold text-white">{userEmail');
    expect(source).toContain("font-bold text-white hover:bg-charcoal");
  });

  it("keeps muted text dark enough on light surfaces", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain("--color-gray: #46544b");
    expect(css).toContain('html[data-theme="light"] .bg-white .text-gray-light');
  });

  it("allows the alerts catalog route into the gym navigation", () => {
    const source = readFileSync("src/features/app/components/app-shell.tsx", "utf8");
    expect(source).toContain('"/alerts"');
  });

  it("allows the facial access catalog route into the gym navigation", () => {
    const source = readFileSync("src/features/app/components/app-shell.tsx", "utf8");
    expect(source).toContain('"/facial-access"');
  });
});
