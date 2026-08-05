import Link from "next/link";

import type { OwnerDashboardDto } from "../types/dashboard.dto";

export function OwnerDashboard({ dashboard }: { dashboard: OwnerDashboardDto }) {
  return <div className="mt-6 space-y-6">
    <section aria-label="Indicadores principales" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric accent="green" detail="Con estado activo hoy" label="Miembros activos" value={count(dashboard.activeMembers)} />
      <Metric accent="orange" detail="Próximos 7 días" label="Membresías por vencer" value={count(dashboard.expiringMemberships)} />
      <Metric accent="red" detail="Miembros únicos con saldo vencido" label="Morosos" value={count(dashboard.overdueMembers)} />
      <Metric accent="blue" detail="Accesos permitidos desde medianoche UTC" label="Entradas de hoy" value={count(dashboard.entriesToday)} />
    </section>

    <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">Ingresos confirmados</p>
        <h2 className="mt-2 text-xl font-black text-ink">Hoy y mes actual</h2>
        {dashboard.income ? <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <IncomePeriod label="Hoy" totals={dashboard.income.today} />
          <IncomePeriod label="Mes actual" totals={dashboard.income.month} />
        </div> : <Restricted />}
        <p className="mt-4 text-xs text-gray">USD y NIO se presentan separados. No se aplica conversión automática.</p>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-orange">Atención</p>
        <h2 className="mt-2 text-xl font-black text-ink">Alertas abiertas</h2>
        <strong className="mt-5 block text-4xl font-black text-ink">{count(dashboard.openAlerts)}</strong>
        <p className="mt-2 text-sm text-gray">Abiertas o reconocidas, aún sin resolver.</p>
      </article>
    </section>

    <section className="rounded-2xl bg-[#111814] p-5 text-white shadow-sm sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-sand">Siguiente acción</p>
      <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div><h2 className="text-xl font-black text-white">Atiende lo importante sin salir del resumen</h2><p className="mt-1 text-sm text-[#dce7df]">Revisa morosidad, vencimientos, ingresos y entradas desde sus módulos operativos.</p></div>
        <div className="flex flex-wrap gap-2"><DashboardLink href="/members" label="Revisar miembros" /><DashboardLink href="/income" label="Ver ingresos" /><DashboardLink href="/entries" label="Ver entradas" /></div>
      </div>
    </section>
  </div>;
}

function Metric({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: "green" | "orange" | "red" | "blue" }) {
  const colors = { green: "border-l-brand-green", orange: "border-l-brand-orange", red: "border-l-red-600", blue: "border-l-blue-600" };
  return <article className={`rounded-2xl border border-slate-200 border-l-4 ${colors[accent]} bg-white p-5 shadow-sm`}><p className="text-sm font-bold text-gray">{label}</p><strong className="mt-3 block text-4xl font-black text-ink">{value}</strong><p className="mt-2 text-xs text-gray">{detail}</p></article>;
}

function IncomePeriod({ label, totals }: { label: string; totals: { USD: string; NIO: string } }) {
  return <div className="rounded-xl bg-slate-50 p-4"><h3 className="text-sm font-black text-ink">{label}</h3><p className="mt-3 text-xl font-black text-brand-green">USD {totals.USD}</p><p className="mt-1 text-xl font-black text-ink">NIO {totals.NIO}</p></div>;
}

function DashboardLink({ href, label }: { href: string; label: string }) { return <Link className="min-h-11 rounded-lg bg-white px-4 py-3 text-sm font-black text-ink hover:bg-brand-sand" href={href}>{label}</Link>; }
function Restricted() { return <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm font-bold text-gray">Sin permiso para consultar esta métrica.</p>; }
function count(value: number | null) { return value == null ? "Sin permiso" : String(value); }
