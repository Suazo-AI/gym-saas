import { notFound } from "next/navigation";

import { getCurrentUser } from "@/features/auth/services/auth.service";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { createClient } from "@/lib/supabase/server";

export default async function SupabaseCheckPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const supabase = await createClient();
  const user = await getCurrentUser();
  const activeGym = await getActiveGym();
  const { data, error } = await supabase.from("saas_plans").select("id, code, name").limit(1);

  const rows = [
    ["Conexion", error ? "Error" : "OK"],
    ["Autenticacion", user ? "Sesion activa" : "Sin sesion"],
    ["Usuario", user?.email ?? "No autenticado"],
    ["Gimnasio disponible", activeGym?.tradeName ?? "Ninguno"],
    ["Consulta segura", data?.[0]?.name ?? "Sin datos visibles"],
    ["Error RLS/consulta", error ? error.message : "Sin error"],
  ];

  return (
    <main className="min-h-screen bg-canvas px-5 py-10 text-ink sm:px-8">
      <section className="mx-auto max-w-5xl">
        <p className="type-eyebrow text-muted">
          Solo desarrollo
        </p>
        <h1 className="mt-3 text-5xl font-black leading-tight">Diagnostico Supabase</h1>
        <dl className="mt-8 grid gap-4 md:grid-cols-2">
          {rows.map(([label, value]) => (
            <div className="rounded-lg border border-line bg-surface p-5 text-ink" key={label}>
              <dt className="type-eyebrow text-muted">{label}</dt>
              <dd className="mt-3 break-words text-xl font-black text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
