import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { IncomeFilters } from "@/features/income/components/income-filters";
import { RecordOtherIncomeForm } from "@/features/income/components/record-other-income-form";
import {
  listDailyIncome,
  listIncomeBranches,
  listIncomeCategories,
  listMonthlyIncome,
} from "@/features/income/services/income.repository";

type IncomePageProps = {
  searchParams: Promise<{ from?: string; to?: string; currency?: string }>;
};

export default async function IncomePage({ searchParams }: IncomePageProps) {
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");

  const params = await searchParams;
  const from = validDate(params.from);
  const to = validDate(params.to);
  const currency: "NIO" | "USD" | undefined =
    params.currency === "NIO" || params.currency === "USD" ? params.currency : undefined;
  const range = { from, to, currency };
  const [dailyIncome, monthlyIncome, categories, branches] = await Promise.all([
    listDailyIncome(activeGym.gymId, range).catch(() => null),
    listMonthlyIncome(activeGym.gymId, range).catch(() => null),
    listIncomeCategories(activeGym.gymId).catch(() => null),
    listIncomeBranches(activeGym.gymId).catch(() => []),
  ]);

  return (
    <>
      <ModuleHeader eyebrow="Ingresos" title="Ingresos del gimnasio" description="Consulta pagos de membresías y registra otros ingresos autorizados." />
      <div className="mt-6">
        {categories ? (
          <RecordOtherIncomeForm branches={branches} categories={categories} defaultCurrency={activeGym.defaultCurrency} />
        ) : (
          <p className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">No pudimos cargar las categorías de ingresos.</p>
        )}
      </div>
      <section className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-xl font-black text-[#083f88]">Historial de ingresos</h2>
          <p className="mt-1 text-sm text-slate-600">Totales calculados con la zona horaria {activeGym.timezone}.</p>
        </div>
        <IncomeFilters currency={currency} from={from} key={`${from ?? ""}:${to ?? ""}:${currency ?? ""}`} to={to} />
        {!dailyIncome || !monthlyIncome ? (
          <p className="p-5 text-sm font-semibold text-red-700">No pudimos cargar ingresos.</p>
        ) : dailyIncome.length === 0 && monthlyIncome.length === 0 ? (
          <p className="p-5 text-slate-600">No hay ingresos visibles.</p>
        ) : (
          <div className="grid gap-6 p-5 lg:grid-cols-2">
            <IncomeSeries title="Totales diarios" empty="No hay ingresos diarios en el rango.">
              {dailyIncome.map((day) => (
                <IncomeRow date={day.incomeDate ?? "Sin fecha"} currency={day.currency ?? ""} total={day.totalIncome} key={`${day.incomeDate}-${day.currency}`} />
              ))}
            </IncomeSeries>
            <IncomeSeries title="Totales mensuales" empty="No hay ingresos mensuales en el rango.">
              {monthlyIncome.map((month) => (
                <IncomeRow date={month.incomeMonth} currency={month.currency} total={month.totalIncome} key={`${month.incomeMonth}-${month.currency}`} />
              ))}
            </IncomeSeries>
          </div>
        )}
      </section>
    </>
  );
}

function IncomeSeries({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const rows = Array.isArray(children) ? children : [children];
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <h3 className="bg-slate-50 px-4 py-3 font-black text-[#083f88]">{title}</h3>
      {rows.length === 0 ? <p className="p-4 text-sm text-slate-600">{empty}</p> : (
        <div className="divide-y divide-slate-100">{children}</div>
      )}
    </div>
  );
}

function IncomeRow({ date, currency, total }: { date: string; currency: string; total: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 p-4">
      <time className="font-bold text-[#083f88]">{date}</time>
      <span className="text-sm font-bold text-slate-800">{currency} {total}</span>
    </div>
  );
}

function validDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? undefined
    : value;
}
