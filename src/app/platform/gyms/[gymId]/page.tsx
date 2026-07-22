import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { getPlatformGymDetail } from "@/features/platform/services/platform.repository";

type PlatformGymDetailPageProps = {
  params: Promise<{ gymId: string }>;
};

export default async function PlatformGymDetailPage({ params }: PlatformGymDetailPageProps) {
  const user = await requireUser();
  if (user.app_metadata?.platform_role !== "admin") {
    redirect("/dashboard");
  }

  const { gymId } = await params;
  const detail = await getPlatformGymDetail(gymId);

  return (
    <PlatformShell currentPath="/platform/gyms" userEmail={user.email}>
      <ModuleHeader
        eyebrow="Cliente SaaS"
        title={detail.gym.trade_name}
        description={`${detail.gym.legal_name} / ${detail.gym.slug}`}
      />

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <Card label="Estado" value={detail.gym.status} />
        <Card label="Moneda" value={detail.gym.default_currency} />
        <Card label="Miembros" value={detail.memberCount} />
        <Card label="Plan SaaS" value={detail.subscription?.planName ?? "Sin plan"} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Suscripcion SaaS">
          {detail.subscription ? (
            <dl className="grid gap-3 text-sm">
              <Row label="Estado" value={detail.subscription.status} />
              <Row label="Precio" value={`${detail.subscription.planCurrency} ${detail.subscription.planPrice}`} />
              <Row label="Periodo actual" value={`${formatDate(detail.subscription.currentPeriodStart)} - ${formatDate(detail.subscription.currentPeriodEnd)}`} />
              <Row label="Cancelar al cierre" value={detail.subscription.cancelAtPeriodEnd ? "Si" : "No"} />
            </dl>
          ) : (
            <p className="text-sm font-semibold text-slate-500">Sin suscripcion activa.</p>
          )}
        </Panel>

        <Panel title="Sucursales">
          <div className="grid gap-3">
            {detail.branches.map((branch) => (
              <article className="rounded-md border border-slate-200 p-4" key={branch.id}>
                <strong className="block text-[#061f46]">{branch.name}</strong>
                <span className="text-sm text-slate-500">{branch.city ?? "Sin ciudad"} / {branch.status}</span>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="Personal">
          <div className="grid gap-3">
            {detail.staff.map((staff) => (
              <article className="rounded-md border border-slate-200 p-4" key={staff.gymUserId}>
                <strong className="block text-[#061f46]">{staff.employeeCode ?? staff.authUserId}</strong>
                <span className="text-sm text-slate-500">{staff.status} / {staff.roles.join(", ") || "sin rol"}</span>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="Auditoria reciente">
          <div className="grid gap-3">
            {detail.recentAuditLogs.length === 0 ? (
              <p className="text-sm font-semibold text-slate-500">Sin eventos recientes.</p>
            ) : detail.recentAuditLogs.map((log) => (
              <article className="rounded-md border border-slate-200 p-4" key={log.auditLogId}>
                <strong className="block text-[#061f46]">{log.action}</strong>
                <span className="text-sm text-slate-500">{log.entityTable} / {formatDate(log.occurredAt)}</span>
              </article>
            ))}
          </div>
        </Panel>
      </section>
    </PlatformShell>
  );
}

function Card({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-[#ff7a1a]">{label}</span>
      <strong className="mt-3 block break-words text-2xl font-black text-[#083f88]">{value}</strong>
    </article>
  );
}

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-xl font-black text-[#061f46]">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
      <dt className="font-bold text-slate-500">{label}</dt>
      <dd className="text-right font-black text-[#061f46]">{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-NI", { dateStyle: "medium" }).format(new Date(value));
}
