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
    <main className="min-h-screen bg-ink text-paper lg:grid lg:grid-cols-[292px_1fr]">
      <aside className="border-b border-charcoal bg-ink p-5 lg:min-h-screen lg:border-b-0 lg:border-r">
        <Link className="flex items-center gap-3 text-lg font-black" href="/platform">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-brand-orange text-ink">
            F
          </span>
          FitManager SaaS
        </Link>

        <div className="mt-8 rounded-lg border border-charcoal bg-charcoal/50 p-4">
          <small className="font-black uppercase tracking-[0.16em] text-brand-sand">
            Consola interna
          </small>
          <strong className="mt-2 block text-xl">Clientes del SaaS</strong>
          <span className="mt-1 block text-sm text-gray-light">Admin de plataforma</span>
        </div>

        <nav className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {nav.map(([label, href]) => (
            <Link
              aria-current={currentPath === href ? "page" : undefined}
              className={`rounded-md px-4 py-3 text-sm font-bold transition ${
                currentPath === href
                  ? "bg-brand-orange text-ink"
                  : "text-gray-light hover:bg-charcoal hover:text-paper"
              }`}
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 rounded-lg border border-charcoal p-4 text-sm text-gray-light">
          <span className="block font-bold text-paper">{userEmail ?? "Admin SaaS"}</span>
        </div>

        <form action={signOutAction} className="mt-4">
          <button
            className="min-h-11 w-full rounded-md border border-gray px-4 py-3 text-sm font-bold text-paper hover:bg-charcoal"
            type="submit"
          >
            Cerrar sesion
          </button>
        </form>
      </aside>

      <section className="min-w-0 bg-paper p-5 text-ink sm:p-8">{children}</section>
    </main>
  );
}
