import Link from "next/link";

import { signOutAction } from "@/features/auth/actions/auth.actions";

const nav = [
  ["Resumen", "/platform"],
  ["Gimnasios", "/platform/gyms"],
  ["Suscripciones", "/platform/subscriptions"],
  ["Facturas", "/platform/invoices"],
  ["Pagos", "/platform/payments"],
  ["Auditoria", "/platform/audit"],
];

type PlatformShellProps = {
  currentPath: string;
  userEmail?: string | null;
  children: React.ReactNode;
};

export function PlatformShell({ currentPath, userEmail, children }: PlatformShellProps) {
  return (
    <main className="min-h-screen bg-[#061f46] text-white lg:grid lg:grid-cols-[292px_1fr]">
      <aside className="border-b border-white/10 bg-[#061f46] p-5 lg:min-h-screen lg:border-b-0 lg:border-r">
        <Link className="flex items-center gap-3 text-lg font-black" href="/platform">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-[#ff7a1a] text-white shadow-lg shadow-orange-950/20">
            F
          </span>
          FitManager SaaS
        </Link>

        <div className="mt-8 rounded-lg border border-white/10 bg-white/8 p-4">
          <small className="font-black uppercase tracking-[0.16em] text-orange-200">
            Consola interna
          </small>
          <strong className="mt-2 block text-xl">Clientes del SaaS</strong>
          <span className="mt-1 block text-sm text-blue-100">Admin de plataforma</span>
        </div>

        <nav className="mt-8 grid gap-2">
          {nav.map(([label, href]) => (
            <Link
              aria-current={currentPath === href ? "page" : undefined}
              className={`rounded-md px-4 py-3 text-sm font-bold transition ${
                currentPath === href
                  ? "bg-[#ff7a1a] text-white"
                  : "text-blue-100 hover:bg-white/10 hover:text-white"
              }`}
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 rounded-lg border border-white/10 p-4 text-sm text-blue-100">
          <span className="block font-bold text-white">{userEmail ?? "Admin SaaS"}</span>
        </div>

        <form action={signOutAction} className="mt-4">
          <button
            className="min-h-11 w-full rounded-md border border-white/20 px-4 py-3 text-sm font-bold text-white hover:bg-white/10"
            type="submit"
          >
            Cerrar sesion
          </button>
        </form>
      </aside>

      <section className="bg-[#f6f9fc] p-5 text-slate-950 sm:p-8">{children}</section>
    </main>
  );
}
