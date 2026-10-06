import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { ModuleHeader } from "@/features/app/components/module-header";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { MemberDetailView } from "@/features/members/components/member-detail-view";
import { MemberAdministration } from "@/features/members/components/member-administration";
import { canManageMembers, getMember } from "@/features/members/services/member.repository";
import { listBranches } from "@/features/settings/services/branch.repository";
import { assignMembershipAction, cancelMembershipAction } from "@/features/memberships/actions/membership.actions";
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

async function cancelMembershipFormAction(formData: FormData) {
  "use server";
  const result = await cancelMembershipAction({ ok: false }, formData);
  const id = String(formData.get("gymMemberId") ?? "");
  if (!result.ok) {
    redirect(`/members/${id}?error=${encodeURIComponent(result.message ?? "No pudimos cancelar la membresía.")}`);
  }
  redirect(`/members/${id}?notice=${encodeURIComponent(result.message ?? "Membresía cancelada.")}`);
}

export default async function MemberDetailPage({
  params,
  searchParams,
}: MemberDetailPageProps) {
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

  const canManage = await canManageMembers(activeGym.gymId);
  const branches = canManage ? await listBranches(activeGym.gymId).catch(() => []) : [];
  const canAssignMembership =
    !member.currentSubscription ||
    ["canceled", "expired"].includes(member.currentSubscription.status);
  const plansResult = canAssignMembership
    ? await listMembershipPlans(activeGym.gymId)
        .then((plans) => ({ plans: plans.filter((plan) => plan.isActive), error: false }))
        .catch(() => ({ plans: [], error: true }))
    : { plans: [], error: false };

  return (
    <>
      <ModuleHeader
        eyebrow="Detalle del miembro"
        title={member.fullName}
        description="Estado observado de membresía, cargos y pagos registrados."
        action={
          <div className="flex flex-wrap gap-2">
          <Link className="btn btn-primary" href={`/entries?gymMemberId=${member.gymMemberId}`}>
            Abrir en recepción
          </Link>
          <Link
            className="btn btn-quiet"
            href="/members"
          >
            Volver a miembros
          </Link>
          </div>
        }
      />
      {query.error ? (
        <div className="mt-6 rounded-xl bg-stop-tint px-4 py-3 text-sm font-semibold text-stop">
          {query.error}
        </div>
      ) : null}
      {query.notice ? (
        <div className="mt-6 rounded-xl bg-ok-tint px-4 py-3 text-sm font-semibold text-ok">
          {query.notice}
        </div>
      ) : null}
      <MemberDetailView
        assignMembershipAction={assignMembershipFormAction}
        cancelMembershipAction={cancelMembershipFormAction}
        gymId={activeGym.gymId}
        member={member}
        membershipPlans={plansResult.plans}
        plansLoadFailed={plansResult.error}
      />
      <MemberAdministration branches={branches} canManage={canManage} member={member} />
    </>
  );
}
