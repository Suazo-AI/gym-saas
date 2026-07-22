import Link from "next/link";
import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { getPlatformDashboard } from "@/features/platform/services/platform.repository";

type PlatformMetadata = {
  platform_role?: string;
};

export default async function PlatformPage() {
  const user = await requireUser();
  const metadata = user.app_metadata as PlatformMetadata;

  if (metadata.platform_role !== "admin") {
    redirect("/dashboard");
  }

  const dashboard = await getPlatformDashboard();

  return (
    <PlatformShell currentPath="/platform" userEmail={user.email}>
      <ModuleHeader
        eyebrow="Plataforma"
        title="Dashboard SaaS"
        description="Control de gimnasios clientes, suscripciones, facturacion y actividad de la plataforma."
      />

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <Metric label="Gimnasios" value={dashboard.metrics.totalGyms} detail={`${dashboard.metrics.activeGyms} activos`} />
        <Metric label="Trials" value={dashboard.metrics.trialingSubscriptions} detail="Suscripciones en prueba" />
        <Metric label="Activas" value={dashboard.metrics.activeSubscriptions} detail="Suscripciones pagas" />
        <Metric label="Vencidas" value={dashboard.metrics.pastDueSubscriptions} detail={`${dashboard.metrics.overdueInvoices} facturas vencidas`} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Clientes recientes" actionHref="/platform/gyms" actionLabel="Ver gimnasios">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="py-3">Gimnasio</th>
                  <th>Estado</th>
                  <th>Plan</th>
                  <th>Miembros</th>
                  <th>Sucursales</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dashboard.gyms.slice(0, 8).map((gym) => (
                  <tr key={gym.gymId}>
                    <td className="py-3">
                      <strong className="block text-[#061f46]">{gym.tradeName}</strong>
                      <span className="text-slate-500">{gym.slug}</span>
                    </td>
                    <td><StatusBadge value={gym.status} /></td>
                    <td>{gym.saasPlanName ?? "Sin plan"}</td>
                    <td>{gym.memberCount}</td>
                    <td>{gym.branchCount}</td>
                    <td>
                      <Link className="font-black text-[#083f88] hover:text-[#ff7a1a]" href={`/platform/gyms/${gym.gymId}`}>
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Suscripciones" actionHref="/platform/subscriptions" actionLabel="Ver todas">
          <div className="grid gap-3">
            {dashboard.subscriptions.slice(0, 6).map((subscription) => (
              <article className="rounded-md border border-slate-200 p-4" key={subscription.subscriptionId}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong className="block text-[#061f46]">{subscription.gymName}</strong>
                    <span className="text-sm text-slate-500">{subscription.planName}</span>
                  </div>
                  <StatusBadge value={subscription.status} />
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  Periodo hasta {formatDate(subscription.currentPeriodEnd)}
                </p>
              </article>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Facturas recientes" actionHref="/platform/invoices" actionLabel="Ver facturas">
          <CompactList
            empty="No hay facturas SaaS."
            items={dashboard.invoices.slice(0, 6).map((invoice) => ({
              id: invoice.invoiceId,
              title: `${invoice.invoiceNumber} - ${invoice.gymName}`,
              meta: `${invoice.currency} ${invoice.totalAmount} / ${invoice.status}`,
            }))}
          />
        </Panel>

        <Panel title="Auditoria reciente" actionHref="/platform/audit" actionLabel="Ver auditoria">
          <CompactList
            empty="No hay auditoria registrada."
            items={dashboard.auditLogs.slice(0, 6).map((log) => ({
              id: String(log.auditLogId),
              title: `${log.action} en ${log.entityTable}`,
              meta: `${log.gymName ?? "Plataforma"} / ${formatDate(log.occurredAt)}`,
            }))}
          />
        </Panel>
      </section>
    </PlatformShell>
  );
}

function Metric({ detail, label, value }: { detail: string; label: string; value: number }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-[#ff7a1a]">{label}</span>
      <strong className="mt-3 block text-4xl font-black text-[#083f88]">{value}</strong>
      <p className="mt-2 text-sm font-semibold text-slate-500">{detail}</p>
    </article>
  );
}

function Panel({
  actionHref,
  actionLabel,
  children,
  title,
}: {
  actionHref: string;
  actionLabel: string;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-black text-[#061f46]">{title}</h2>
        <Link className="text-sm font-black text-[#083f88] hover:text-[#ff7a1a]" href={actionHref}>
          {actionLabel}
        </Link>
      </div>
      {children}
    </section>
  );
}

function CompactList({
  empty,
  items,
}: {
  empty: string;
  items: Array<{ id: string; title: string; meta: string }>;
}) {
  if (items.length === 0) {
    return <p className="rounded-md bg-slate-50 p-4 text-sm font-semibold text-slate-500">{empty}</p>;
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article className="rounded-md border border-slate-200 p-4" key={item.id}>
          <strong className="block text-[#061f46]">{item.title}</strong>
          <span className="mt-1 block text-sm text-slate-500">{item.meta}</span>
        </article>
      ))}
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-[#083f88]">
      {value}
    </span>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "sin fecha";
  }

  return new Intl.DateTimeFormat("es-NI", { dateStyle: "medium" }).format(new Date(value));
}
