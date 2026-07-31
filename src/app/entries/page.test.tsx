import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMember: vi.fn(),
  listGymEntries: vi.fn(),
  listMembers: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/auth/services/auth.service", () => ({
  requireUser: vi.fn().mockResolvedValue({ email: "owner@example.com" }),
}));
vi.mock("@/features/gyms/services/get-active-gym", () => ({
  getActiveGym: vi.fn().mockResolvedValue({
    gymId: "20000000-0000-4000-8000-000000000001",
    tradeName: "Impulso Fitness",
  }),
}));
vi.mock("@/features/entries/services/entry.repository", () => ({
  listGymEntries: mocks.listGymEntries,
}));
vi.mock("@/features/members/services/member.repository", () => ({
  getMember: mocks.getMember,
  listMembers: mocks.listMembers,
}));
vi.mock("@/features/entries/components/face-access-modal", () => ({
  FaceAccessModal: () => <button>Entrada facial</button>,
}));
vi.mock("@/features/entries/components/manual-entry-form", () => ({
  ManualEntryForm: ({ memberFullName }: { memberFullName: string }) => (
    <button>Registrar entrada de {memberFullName}</button>
  ),
}));
vi.mock("@/features/app/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/features/app/components/module-header", () => ({
  ModuleHeader: ({ title, action }: { title: string; action: React.ReactNode }) => (
    <header><h1>{title}</h1>{action}</header>
  ),
}));

import EntriesPage from "./page";

describe("EntriesPage", () => {
  beforeEach(() => {
    mocks.getMember.mockReset();
    mocks.listGymEntries.mockReset();
    mocks.listMembers.mockReset();
  });

  it("renders the empty search and history states", async () => {
    mocks.listGymEntries.mockResolvedValue([]);

    const element = await EntriesPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Escribe un nombre o código para comenzar.");
    expect(html).toContain("Todavía no hay entradas registradas.");
    expect(html).toContain("Entrada facial");
    expect(mocks.listMembers).not.toHaveBeenCalled();
  });

  it("renders unified entries with Spanish source, decision and formatted date", async () => {
    mocks.listGymEntries.mockResolvedValue([{
      gymId: "20000000-0000-4000-8000-000000000001",
      entryId: "entry-1",
      gymMemberId: "member-1",
      source: "manual",
      decision: "denied",
      decisionReason: "El miembro tiene cargos vencidos.",
      occurredAt: "2026-07-30T15:00:00.000Z",
    }]);

    const element = await EntriesPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Manual");
    expect(html).toContain("Bloqueada");
    expect(html).toContain("El miembro tiene cargos vencidos.");
    expect(html).not.toContain("2026-07-30T15:00:00.000Z</time>");
  });
});
