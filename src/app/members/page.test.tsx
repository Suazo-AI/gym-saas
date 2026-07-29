import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/auth/services/auth.service", () => ({
  requireUser: vi.fn().mockResolvedValue({ email: "owner@example.com" }),
}));
vi.mock("@/features/gyms/services/get-active-gym", () => ({
  getActiveGym: vi.fn().mockResolvedValue({ gymId: "gym-1", tradeName: "Impulso Fitness" }),
}));
vi.mock("@/features/members/services/member.repository", () => ({
  listMembers: vi.fn().mockResolvedValue({
    data: [{
      gymMemberId: "member-1",
      fullName: "Ana Martínez",
      memberCode: "M-0001",
      status: "active",
      membershipPlanName: "Mensual",
      overdueAmount: "0.00",
    }],
    pagination: { page: 1, pageCount: 1, total: 1 },
  }),
}));
vi.mock("@/features/app/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/features/app/components/module-header", () => ({
  ModuleHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import MembersPage from "./page";

describe("MembersPage", () => {
  it("links every visible member to its real detail route", async () => {
    const element = await MembersPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('href="/members/member-1"');
    expect(html).toContain("Ver detalle");
  });
});
