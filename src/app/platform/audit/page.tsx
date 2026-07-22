import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { getPlatformDashboard } from "@/features/platform/services/platform.repository";

export default async function PlatformAuditPage() {
  const user = await requireUser();
  if (user.app_metadata?.platform_role !== "admin") {
    redirect("/dashboard");
  }

  const dashboard = await getPlatformDashboard();

  return (
    <PlatformShell currentPath="/platform/audit" userEmail={user.email}>
      <ModuleHeader
        eyebrow="Seguridad"
        title="Auditoria"
        description="Eventos criticos registrados por operaciones de gimnasios y plataforma."
      />
      <section className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr><th className="py-3">Fecha</th><th>Gimnasio</th><th>Accion</th><th>Entidad</th><th>Actor</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dashboard.auditLogs.map((log) => (
              <tr key={log.auditLogId}>
                <td className="py-4">{formatDate(log.occurredAt)}</td>
                <td className="font-black text-[#061f46]">{log.gymName ?? "Plataforma"}</td>
                <td>{log.action}</td>
                <td>{log.entityTable}{log.entityId ? ` / ${log.entityId}` : ""}</td>
                <td>{log.actorUserId ?? "Sistema"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </PlatformShell>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-NI", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
