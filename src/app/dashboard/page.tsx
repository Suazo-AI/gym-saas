import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/features/app/components/app-shell";
import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";

export default async function DashboardPage() {
  const user = await requireUser();
  const activeGym = await getActiveGym();

  if (!activeGym) {
    redirect("/login");
  }

  return (
    <AppShell activeGym={activeGym} currentPath="/dashboard" userEmail={user.email}>
      <ModuleHeader
        eyebrow="Panel protegido"
        title="Resumen operativo"
        description={`Sesion activa para ${user.email}. Las metricas se conectaran a vistas y RPC bajo RLS.`}
        action={
          <Link
            className="rounded-md bg-[#ff7a1a] px-5 py-3 text-center text-sm font-black text-white hover:bg-[#e86305]"
            href="/dev/supabase-check"
          >
            Revisar Supabase
          </Link>
        }
      />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          ["Miembros", "Contrato listo", "La vista usa api_v1_member_summaries con RLS."],
          ["Gimnasio", activeGym.tradeName, "Derivado de membresia activa del usuario."],
          ["Seguridad", "RLS primero", "No se acepta gym_id arbitrario sin verificar pertenencia."],
        ].map(([label, value, text]) => (
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" key={label}>
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#ff7a1a]">{label}</span>
            <strong className="mt-3 block text-2xl font-black text-[#083f88]">{value}</strong>
            <p className="mt-3 leading-7 text-slate-600">{text}</p>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
