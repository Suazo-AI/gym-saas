import Link from "next/link";

import type { OwnerDashboardDto } from "../types/dashboard.dto";

export function OwnerDashboard({ dashboard }: { dashboard: OwnerDashboardDto }) {
  return <div className="mt-6 space-y-6">
    <section aria-label="Indicadores principales" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <Metric detail="Con estado activo hoy" label="Miembros activos" value={dashboard.activeMembers} />
      <Metric detail="Próximos 7 días" label="Membresías por vencer" tone="wait" value={dashboard.expiringMemberships} />
      <Metric detail="Miembros únicos con saldo vencido" label="Morosos" tone="stop" value={dashboard.overdueMembers} />
      <Metric detail="Accesos permitidos desde medianoche UTC" label="Entradas de hoy" value={dashboard.entriesToday} />
    </section>

    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <article className="panel p-5 sm:p-6">
        <p className="type-eyebrow">Ingresos confirmados</p>
        <h2 className="type-heading mt-1">Hoy y mes actual</h2>
        {dashboard.income ? <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <IncomePeriod label="Hoy" totals={dashboard.income.today} />
          <IncomePeriod label="Mes actual" totals={dashboard.income.month} />
        </div> : <Restricted />}
        <p className="mt-4 text-xs text-muted">USD y NIO se presentan separados. No se aplica conversión automática.</p>
      </article>
      <article className="panel flex flex-col p-5 sm:p-6">
        <p className="type-eyebrow">Atención</p>
        <h2 className="type-heading mt-1">Alertas abiertas</h2>
        <strong className={`type-figure mt-5 block text-5xl ${dashboard.openAlerts ? "text-wait" : "text-ink"}`}>{count(dashboard.openAlerts)}</strong>
        <p className="mt-2 text-sm text-muted">Abiertas o reconocidas, aún sin resolver.</p>
        <Link className="btn btn-secondary mt-auto self-start" href="/alerts">Ver alertas</Link>
      </article>
    </section>

    <section className="panel flex flex-col justify-between gap-4 p-5 sm:p-6 md:flex-row md:items-center">
      <div>
        <p className="type-eyebrow">Siguiente acción</p>
        <h2 className="type-heading mt-1">Atiende lo importante sin salir del resumen</h2>
        <p className="mt-1 text-sm text-muted">Revisa morosidad, vencimientos, ingresos y entradas desde sus módulos operativos.</p>
      </div>
      {/* El enlace a ingresos sale del mismo dato que decide la metrica de arriba.
          Sin income.read, dashboard.income llega nulo: mostrar el boton igual manda
          a recepcion a una pantalla que la RPC rechaza con 42501, sin salida. */}
      <div className="flex flex-wrap gap-2"><DashboardLink href="/members" label="Revisar miembros" />{dashboard.income ? <DashboardLink href="/income" label="Ver ingresos" /> : null}<DashboardLink href="/entries" label="Ver entradas" /></div>
    </section>
  </div>;
}

function Metric({ label, value, detail, tone }: { label: string; value: number | null; detail: string; tone?: "wait" | "stop" }) {
  const color = value && tone === "stop" ? "text-stop" : value && tone === "wait" ? "text-wait" : "text-ink";
  return <article className="panel p-4 sm:p-5">
    <p className="text-sm font-medium text-ink-2">{label}</p>
    <strong className={`type-figure mt-3 block ${value == null ? "text-xl text-muted" : `text-4xl sm:text-5xl ${color}`}`}>{count(value)}</strong>
    <p className="mt-2 text-xs text-muted">{detail}</p>
  </article>;
}

function IncomePeriod({ label, totals }: { label: string; totals: { USD: string; NIO: string } }) {
  return <div className="rounded-xl bg-fill p-4"><h3 className="text-sm font-semibold text-ink-2">{label}</h3><p className="type-figure mt-3 text-2xl text-ink">USD {totals.USD}</p><p className="type-figure mt-1.5 text-2xl text-ink">NIO {totals.NIO}</p></div>;
}

function DashboardLink({ href, label }: { href: string; label: string }) { return <Link className="btn btn-secondary" href={href}>{label}</Link>; }
function Restricted() { return <p className="mt-5 rounded-xl bg-fill p-4 text-sm font-medium text-muted">Sin permiso para consultar esta métrica.</p>; }
function count(value: number | null) { return value == null ? "Sin permiso" : String(value); }
