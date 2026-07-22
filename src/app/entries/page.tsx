import { redirect } from "next/navigation";

import { AppShell } from "@/features/app/components/app-shell";
import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { FaceAccessModal } from "@/features/entries/components/face-access-modal";
import { listRecentEntryEvents } from "@/features/entries/services/entry.repository";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";

export default async function EntriesPage() {
  const user = await requireUser();
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");
  const events = await listRecentEntryEvents(activeGym.gymId).catch(() => null);

  return (
    <AppShell activeGym={activeGym} currentPath="/entries" userEmail={user.email}>
      <ModuleHeader
        action={<FaceAccessModal />}
        eyebrow="Entradas"
        title="Recepcion rapida"
        description="Verificacion facial automatica con camara, matching biometrico y validacion de suscripcion activa."
      />
      <section className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-xl font-black text-[#083f88]">Eventos recientes</h2>
          <p className="mt-1 text-sm text-slate-600">Lectura de face_recognition_events bajo RLS; el registro manual queda para la siguiente RPC.</p>
        </div>
        {!events ? (
          <p className="p-5 text-sm font-semibold text-red-700">No pudimos cargar eventos.</p>
        ) : events.length === 0 ? (
          <p className="p-5 text-slate-600">No hay entradas visibles.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {events.map((event) => (
              <div className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_1fr] md:items-center" key={event.id}>
                <strong className="text-[#083f88]">{event.decision}</strong>
                <span className="text-sm text-slate-600">{event.decisionReason ?? "Sin motivo"}</span>
                <time className="text-sm text-slate-600">{event.occurredAt}</time>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
