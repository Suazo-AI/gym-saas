import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AppShell theme contrast", () => {
  it("draws navigation on theme surfaces instead of fixed colors", () => {
    const source = readFileSync("src/features/app/components/app-shell.tsx", "utf8");
    expect(source).not.toContain("bg-[#");
    expect(source).toContain("bg-surface");
    expect(source).toContain('text-ink">{userEmail');
  });

  it("defines every semantic token for light and dark themes", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const light = css.slice(css.indexOf(':root,'), css.indexOf('html[data-theme="dark"] {'));
    const dark = css.slice(css.indexOf('html[data-theme="dark"] {'), css.indexOf("@theme inline {"));
    for (const token of ["--canvas", "--surface", "--ink", "--muted", "--line", "--accent", "--ok", "--stop", "--wait"]) {
      expect(light).toContain(`${token}:`);
      expect(dark).toContain(`${token}:`);
    }
    // Muted text on white stays at or above 4.5:1.
    expect(light).toContain("--muted: #5a6760");
  });

  it("allows the alerts catalog route into the gym navigation", () => {
    const source = readFileSync("src/features/app/components/app-shell.tsx", "utf8");
    expect(source).toContain('"/alerts"');
  });

  it("allows the facial access catalog route into the gym navigation", () => {
    const source = readFileSync("src/features/app/components/app-shell.tsx", "utf8");
    expect(source).toContain('"/facial-access"');
  });

  it("renders the server-authorized active gym switcher", () => {
    const source = readFileSync("src/features/app/components/app-shell.tsx", "utf8");
    expect(source).toContain("ActiveGymSwitcher");
    expect(source).toContain("availableGyms={availableGyms}");
  });

  it("keeps the full sidebar off the mobile content path", () => {
    const source = readFileSync("src/features/app/components/app-shell.tsx", "utf8");
    expect(source).toContain("lg:hidden");
    expect(source).toContain('<aside className="hidden ');
    expect(source).toContain("lg:flex");
    expect(source).toContain("Abrir menu principal");
  });
});
