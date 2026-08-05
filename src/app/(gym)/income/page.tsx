import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { listDailyIncome } from "@/features/income/services/income.repository";

export default async function IncomePage() {
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");
  const income = await listDailyIncome(activeGym.gymId).catch(() => null);

  return (
    <>
      <ModuleHeader eyebrow="Ingresos" title="Ingresos del gimnasio" description="Modulo simple para ingresos de membresias y otros ingresos autorizados." />
      <section className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-xl font-black text-[#083f88]">Ingresos diarios</h2>
          <p className="mt-1 text-sm text-slate-600">Lectura de v_gym_income_daily bajo RLS.</p>
        </div>
        {!income ? (
          <p className="p-5 text-sm font-semibold text-red-700">No pudimos cargar ingresos.</p>
        ) : income.length === 0 ? (
          <p className="p-5 text-slate-600">No hay ingresos visibles.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {income.map((day) => (
              <div className="grid gap-3 p-4 md:grid-cols-[1fr_1fr] md:items-center" key={`${day.incomeDate}-${day.currency}`}>
                <time className="font-bold text-[#083f88]">{day.incomeDate ?? "Sin fecha"}</time>
                <span className="text-sm font-bold text-slate-800">{day.currency} {day.totalIncome}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
