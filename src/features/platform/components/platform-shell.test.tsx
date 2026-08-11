import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/actions/auth.actions", () => ({ signOutAction: vi.fn() }));
vi.mock("@/features/app/components/preferences-controls", () => ({ PreferencesControls: () => null }));

import { PlatformShell } from "./platform-shell";

describe("PlatformShell", () => {
  it("shares the gym manager sidebar visual contract", () => {
    const source = readFileSync("src/features/platform/components/platform-shell.tsx", "utf8");
    expect(source).toContain("lg:grid-cols-[272px_1fr]");
    expect(source).toContain("bg-[#111814]");
    expect(source).toContain("bg-brand-green text-white shadow-sm");
    expect(source).toContain("PreferencesControls");
  });

  it("renders only navigation authorized by the server", () => {
    const html = renderToStaticMarkup(
      <PlatformShell
        currentPath="/platform"
        navigation={[{ label: "Resumen", href: "/platform" }]}
      >
        <p>Contenido</p>
      </PlatformShell>,
    );
    expect(html).toContain("Resumen");
    expect(html).not.toContain('href="/platform/audit"');
  });
});
