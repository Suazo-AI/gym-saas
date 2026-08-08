import Link from "next/link";
import { redirect } from "next/navigation";

import { AlertList } from "@/features/alerts/components/alert-list";
import { alertStatusSchema } from "@/features/alerts/schemas/alert.schema";
import { listGymAlerts } from "@/features/alerts/services/alert.repository";
import type { AlertStatus } from "@/features/alerts/types/alert.dto";
import { ModuleHeader } from "@/features/app/components/module-header";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";

type AlertsPageProps = { searchParams: Promise<{ status?: string }> };
const filters: { label: string; status?: AlertStatus }[] = [
  { label: "Todas" },
  { label: "Abiertas", status: "open" },
  { label: "Reconocidas", status: "acknowledged" },
  { label: "Resueltas", status: "resolved" },
  { label: "Descartadas", status: "dismissed" },
];

export default async function AlertsPage({ searchParams }: AlertsPageProps) {
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");

  const requestedStatus = (await searchParams).status;
  const parsedStatus = requestedStatus ? alertStatusSchema.safeParse(requestedStatus) : null;
  const status = parsedStatus?.success ? parsedStatus.data : undefined;
  const alerts = await listGymAlerts(activeGym.gymId, status).catch(() => null);

  return (
    <>
      <ModuleHeader eyebrow="Alertas" title="Alertas del gimnasio" description="Revisa incidentes de acceso, membresias y dispositivos que requieren atencion." />
      <nav aria-label="Filtrar alertas por estado" className="mt-6 flex flex-wrap gap-2">
        {filters.map((filter) => {
          const selected = filter.status === status && (filter.status !== undefined || !requestedStatus);
          return <Link aria-current={selected ? "page" : undefined} className={`min-h-11 rounded-lg border px-4 py-3 text-sm font-black ${selected ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-ink"}`} href={filter.status ? `/alerts?status=${filter.status}` : "/alerts"} key={filter.label}>{filter.label}</Link>;
        })}
      </nav>
      <section className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
        {!alerts ? <p className="p-5 text-sm font-semibold text-red-700" role="alert">No pudimos cargar las alertas. Intenta nuevamente.</p> : <AlertList alerts={alerts} />}
      </section>
    </>
  );
}
