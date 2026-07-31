import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMember: vi.fn(),
  listMembershipPlans: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: vi.fn(),
}));

vi.mock("@/features/auth/services/auth.service", () => ({
  requireUser: vi.fn().mockResolvedValue({ email: "owner@example.com" }),
}));

vi.mock("@/features/gyms/services/get-active-gym", () => ({
  getActiveGym: vi.fn().mockResolvedValue({ gymId: "gym-1", tradeName: "Impulso Fitness" }),
}));

vi.mock("@/features/members/services/member.repository", () => ({
  getMember: mocks.getMember,
}));

vi.mock("@/features/memberships/services/membership.repository", () => ({
  listMembershipPlans: mocks.listMembershipPlans,
}));

vi.mock("@/features/memberships/actions/membership.actions", () => ({
  assignMembershipAction: vi.fn(),
}));

vi.mock("@/features/app/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/features/app/components/module-header", () => ({
  ModuleHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import MemberDetailPage from "./page";

describe("MemberDetailPage", () => {
  const gymMemberId = "2f1a174a-54b0-4c62-aea8-8db35fda743d";
  const member = {
    gymId: "gym-1",
    gymMemberId,
    personId: "person-1",
    memberCode: "M-0001",
    firstName: "Ana",
    lastName: "Martínez",
    fullName: "Ana Martínez",
    status: "prospect",
    branchId: null,
    branchName: null,
    primaryPhotoMediaAssetId: null,
    membershipStatus: null,
    membershipPlanName: null,
    nextPaymentDate: null,
    overdueAmount: "0.00",
    hasOverdueCharges: false,
    createdAt: "2026-07-30T10:00:00+00:00",
    middleName: null,
    secondLastName: null,
    birthDate: null,
    sex: null,
    notes: null,
    contacts: [],
    primaryAddress: null,
    currentSubscription: null,
    pendingCharges: [],
    paymentSummary: null,
  };

  beforeEach(() => {
    mocks.getMember.mockReset();
    mocks.listMembershipPlans.mockReset();
    mocks.notFound.mockReset();
    mocks.listMembershipPlans.mockResolvedValue([
      {
        id: "40000000-0000-4000-8000-000000000001",
        code: "monthly",
        name: "Mensual",
        price: "900.00",
        currency: "NIO",
        billingCycleMonths: 1,
        graceDays: 3,
        isActive: true,
      },
    ]);
  });

  it("loads the member inside the active gym and renders the detail", async () => {
    mocks.getMember.mockResolvedValue(member);

    const element = await MemberDetailPage({
      params: Promise.resolve({ gymMemberId }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element);

    expect(mocks.getMember).toHaveBeenCalledWith({
      gymId: "gym-1",
      gymMemberId,
    });
    expect(html).toContain("Ana Martínez");
  });

  it("returns not found without querying PostgreSQL for a malformed member id", async () => {
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    await expect(
      MemberDetailPage({
        params: Promise.resolve({ gymMemberId: "member-1" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.getMember).not.toHaveBeenCalled();
  });

  it("shows the assignment form when there is no current subscription", async () => {
    mocks.getMember.mockResolvedValue(member);

    const element = await MemberDetailPage({
      params: Promise.resolve({ gymMemberId }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('name="membershipPlanId"');
    expect(html).toContain("Generar el primer cargo");
    expect(html).toContain("Mensual · NIO 900.00");
  });

  it("does not show the assignment form when the member has a current subscription", async () => {
    mocks.getMember.mockResolvedValue({
      ...member,
      status: "active",
      membershipStatus: "active",
      currentSubscription: {
        id: "70000000-0000-4000-8000-000000000001",
        status: "active",
        startDate: "2026-07-01",
        endDate: null,
        billingCycleMonths: 1,
        recurringAmount: "900.00",
        currency: "NIO",
        planId: "40000000-0000-4000-8000-000000000001",
        planName: "Mensual",
      },
    });

    const element = await MemberDetailPage({
      params: Promise.resolve({ gymMemberId }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Membresía actual");
    expect(html).not.toContain('name="membershipPlanId"');
    expect(mocks.listMembershipPlans).not.toHaveBeenCalled();
  });
});
