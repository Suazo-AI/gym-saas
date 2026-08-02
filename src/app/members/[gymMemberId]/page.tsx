import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { AppShell } from "@/features/app/components/app-shell";
import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { MemberDetailView } from "@/features/members/components/member-detail-view";
import { getMember } from "@/features/members/services/member.repository";

type MemberDetailPageProps = {
  params: Promise<{ gymMemberId: string }>;
};

const uuidSchema = z.string().uuid();

export default async function MemberDetailPage({ params }: MemberDetailPageProps) {
  const user = await requireUser();
  const activeGym = await getActiveGym();

  if (!activeGym) {
    redirect("/login");
  }

  const { gymMemberId } = await params;

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

  return (
    <AppShell activeGym={activeGym} currentPath="/members" userEmail={user.email}>
      <ModuleHeader
        eyebrow="Detalle del miembro"
        title={member.fullName}
        description="Estado observado de membresía, cargos y pagos registrados."
        action={
          <Link
            className="rounded-md border border-charcoal px-5 py-3 text-center text-sm font-black text-ink hover:bg-gray-light"
            href="/members"
          >
            Volver a miembros
          </Link>
        }
      />
      <MemberDetailView member={member} />
    </AppShell>
  );
}
