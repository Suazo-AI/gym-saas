import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("PlatformShell",()=>{it("shares the gym manager sidebar visual contract",()=>{const source=readFileSync("src/features/platform/components/platform-shell.tsx","utf8");expect(source).toContain("lg:grid-cols-[272px_1fr]");expect(source).toContain("bg-[#111814]");expect(source).toContain("bg-brand-green text-white shadow-sm");expect(source).toContain("PreferencesControls");});});
