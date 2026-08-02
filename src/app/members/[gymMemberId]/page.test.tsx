import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMember: vi.fn(),
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

vi.mock("@/features/app/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/features/app/components/module-header", () => ({
  ModuleHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock("@/features/members/components/member-detail-view", () => ({
  MemberDetailView: ({ member }: { member: { gymMemberId: string } }) => (
    <div>Detalle {member.gymMemberId}</div>
  ),
}));

import MemberDetailPage from "./page";

describe("MemberDetailPage", () => {
  const gymMemberId = "2f1a174a-54b0-4c62-aea8-8db35fda743d";

  beforeEach(() => {
    mocks.getMember.mockReset();
    mocks.notFound.mockReset();
  });

  it("loads the member inside the active gym and renders the detail", async () => {
    mocks.getMember.mockResolvedValue({ gymMemberId, fullName: "Ana Martínez" });

    const element = await MemberDetailPage({
      params: Promise.resolve({ gymMemberId }),
    });
    const html = renderToStaticMarkup(element);

    expect(mocks.getMember).toHaveBeenCalledWith({
      gymId: "gym-1",
      gymMemberId,
    });
    expect(html).toContain("Ana Martínez");
    expect(html).toContain(`Detalle ${gymMemberId}`);
  });

  it("returns not found without querying PostgreSQL for a malformed member id", async () => {
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    await expect(
      MemberDetailPage({
        params: Promise.resolve({ gymMemberId: "member-1" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.getMember).not.toHaveBeenCalled();
  });
});
