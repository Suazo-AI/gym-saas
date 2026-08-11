import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMember: vi.fn(),
  listGymEntries: vi.fn(),
  searchEntryMembers: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn(), useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/entries", useSearchParams: () => new URLSearchParams() }));
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
}));
vi.mock("@/features/entries/services/entry-member-search.repository", () => ({
  searchEntryMembers: mocks.searchEntryMembers,
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
    mocks.searchEntryMembers.mockReset();
  });

  it("renders the empty search and history states", async () => {
    mocks.listGymEntries.mockResolvedValue([]);

    const element = await EntriesPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Escribe un nombre, teléfono o código para comenzar.");
    expect(html).toContain("Todavía no hay entradas registradas.");
    expect(html).toContain("Entrada facial");
    expect(mocks.listGymEntries).toHaveBeenCalledWith({
      gymId: "20000000-0000-4000-8000-000000000001",
      from: undefined,
      to: undefined,
    });
    expect(mocks.searchEntryMembers).not.toHaveBeenCalled();
  });

  it("searches by the submitted term and renders only name and code", async () => {
    mocks.listGymEntries.mockResolvedValue([]);
    mocks.searchEntryMembers.mockResolvedValue([{
      gymMemberId: "member-1",
      memberCode: "M-001",
      fullName: "Ana Pérez",
      status: "active",
      membershipStatus: "active",
      hasOverdueCharges: false,
    }]);

    const element = await EntriesPage({
      searchParams: Promise.resolve({ search: "8888-0001" }),
    });
    const html = renderToStaticMarkup(element);

    expect(mocks.searchEntryMembers).toHaveBeenCalledWith({
      gymId: "20000000-0000-4000-8000-000000000001",
      search: "8888-0001",
    });
    expect(html).toContain("Ana Pérez");
    expect(html).toContain("M-001");
    expect(html).not.toContain("8888-0001</span>");
    expect(html).toContain("Buscar por nombre, teléfono o código");
  });

  it("shows private access guidance for the selected member", async () => {
    mocks.listGymEntries.mockResolvedValue([]);
    mocks.getMember.mockResolvedValue({
      gymMemberId: "member-1",
      branchId: "branch-1",
      memberCode: "M-001",
      fullName: "Ana Pérez",
      status: "active",
      membershipStatus: "past_due",
      hasOverdueCharges: true,
      contacts: [{ type: "phone", value: "8888-0001" }],
      overdueAmount: "900.00",
      nextPaymentDate: "2026-08-15",
    });

    const element = await EntriesPage({
      searchParams: Promise.resolve({ gymMemberId: "member-1" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Acceso no permitido");
    expect(html).toContain("Revisar membresía en recepción");
    expect(html).not.toContain("8888-0001");
    expect(html).not.toContain("900.00");
    expect(html).not.toContain("2026-08-15");
  });

  it("renders unified entries with Spanish source, decision and formatted date", async () => {
    mocks.listGymEntries.mockResolvedValue([{
      gymId: "20000000-0000-4000-8000-000000000001",
      entryId: "entry-1",
      gymMemberId: "member-1",
      source: "manual",
      decision: "denied",
      decisionReason: "El miembro tiene cargos vencidos.",
      membershipStatus: "past_due",
      hasOverdueCharges: true,
      occurredAt: "2026-07-30T15:00:00.000Z",
    }]);

    const element = await EntriesPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Manual");
    // Un moroso es un moroso, no un bloqueado: la etiqueta del historial tiene que
    // decir lo mismo que el motivo guardado debajo.
    expect(html).toContain("Morosa");
    expect(html).not.toContain("Bloqueada");
    expect(html).toContain("El miembro tiene cargos vencidos.");
    expect(html).not.toContain("2026-07-30T15:00:00.000Z</time>");
  });

  it("no rotula al prospecto como bloqueado en el historial", async () => {
    mocks.listGymEntries.mockResolvedValue([{
      gymId: "20000000-0000-4000-8000-000000000001",
      entryId: "entry-2",
      gymMemberId: "member-2",
      source: "manual",
      decision: "denied",
      decisionReason: "El miembro aún no tiene una membresía.",
      membershipStatus: "prospect",
      hasOverdueCharges: false,
      occurredAt: "2026-07-30T15:00:00.000Z",
    }]);

    const element = await EntriesPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Sin membresía");
    expect(html).not.toContain("Bloqueada");
  });
});
