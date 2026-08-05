import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { AppShell } from "@/features/app/components/app-shell";
import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { MemberDetailView } from "@/features/members/components/member-detail-view";
import { getMember } from "@/features/members/services/member.repository";
import { assignMembershipAction } from "@/features/memberships/actions/membership.actions";
import { listMembershipPlans } from "@/features/memberships/services/membership.repository";

type MemberDetailPageProps = {
  params: Promise<{ gymMemberId: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
};

const uuidSchema = z.string().uuid();

async function assignMembershipFormAction(formData: FormData) {
  "use server";
  const result = await assignMembershipAction({ ok: false }, formData);
  const id = String(formData.get("gymMemberId") ?? "");
  if (!result.ok) {
    redirect(`/members/${id}?error=${encodeURIComponent(result.message ?? "No pudimos asignar la membresía.")}`);
  }
  redirect(`/members/${id}?notice=${encodeURIComponent("Membresía asignada.")}`);
}

export default async function MemberDetailPage({
  params,
  searchParams,
}: MemberDetailPageProps) {
  const user = await requireUser();
  const activeGym = await getActiveGym();

  if (!activeGym) {
    redirect("/login");
  }

  const { gymMemberId } = await params;
  const query = await searchParams;

  if (!uuidSchema.safeParse(gymMemberId).success) {
    notFound();
  }

  const member = await getMember({
    gymId: activeGym.gymId,
    gymMemberId,
  });

  if (!member) {
    notFound();
  }

  const canAssignMembership =
    !member.currentSubscription ||
    ["canceled", "expired"].includes(member.currentSubscription.status);
  const plansResult = canAssignMembership
    ? await listMembershipPlans(activeGym.gymId)
        .then((plans) => ({ plans: plans.filter((plan) => plan.isActive), error: false }))
        .catch(() => ({ plans: [], error: true }))
    : { plans: [], error: false };

  return (
    <AppShell activeGym={activeGym} currentPath="/members" userEmail={user.email}>
      <ModuleHeader
        eyebrow="Detalle del miembro"
        title={member.fullName}
        description="Estado observado de membresía, cargos y pagos registrados."
        action={
          <Link
            className="min-h-11 rounded-md border border-charcoal px-5 py-3 text-center text-sm font-black text-ink hover:bg-gray-light"
            href="/members"
          >
            Volver a miembros
          </Link>
        }
      />
      {query.error ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          {query.error}
        </div>
      ) : null}
      {query.notice ? (
        <div className="mt-6 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-900">
          {query.notice}
        </div>
      ) : null}
      <MemberDetailView
        assignMembershipAction={assignMembershipFormAction}
        gymId={activeGym.gymId}
        member={member}
        membershipPlans={plansResult.plans}
        plansLoadFailed={plansResult.error}
      />
    </AppShell>
  );
}
