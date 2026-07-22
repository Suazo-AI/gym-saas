import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/features/auth/services/auth.service";

type PlatformMetadata = {
  platform_role?: string;
};

export default async function PlatformPage() {
  const user = await requireUser();
  const metadata = user.app_metadata as PlatformMetadata;

  if (metadata.platform_role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#061f46] text-white">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl content-center gap-8 px-5 py-10">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-200">
            Plataforma FitManager
          </p>
          <h1 className="mt-4 text-4xl font-black leading-tight sm:text-6xl">
            Consola interna local
          </h1>
          <p className="mt-5 max-w-2xl text-lg font-medium text-blue-100">
            Entrada protegida para validar acceso de administrador SaaS. Las operaciones sensibles
            de plataforma quedan pendientes de una tarjeta y permisos formales.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Sesion" value={user.email ?? "Usuario activo"} />
          <Metric label="Rol plataforma" value="admin" />
          <Metric label="Alcance" value="Solo diagnostico local" />
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-[#ff7a1a] px-5 py-3 text-sm font-black text-white hover:bg-[#e86305]"
            href="/dashboard"
          >
            Ir al dashboard
          </Link>
          <Link
            className="rounded-md border border-white/25 px-5 py-3 text-sm font-black text-white hover:bg-white/10"
            href="/dev/supabase-check"
          >
            Diagnostico Supabase
          </Link>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/8 p-5">
      <span className="text-xs font-black uppercase tracking-[0.16em] text-orange-200">
        {label}
      </span>
      <strong className="mt-3 block break-words text-2xl font-black">{value}</strong>
    </div>
  );
}
