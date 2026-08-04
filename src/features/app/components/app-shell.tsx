import Link from "next/link";

import { signOutAction } from "@/features/auth/actions/auth.actions";
import type { ActiveGymDto } from "@/features/gyms/types/gym.dto";

const nav = [
  ["Resumen", "/dashboard"],
  ["Miembros", "/members"],
  ["Membresias", "/memberships"],
  ["Pagos", "/payments"],
  ["Entradas", "/entries"],
  ["Ingresos", "/income"],
  ["Personal", "/staff"],
  ["Configuracion", "/settings"],
];

type AppShellProps = {
  activeGym: ActiveGymDto;
  currentPath: string;
  userEmail?: string | null;
  children: React.ReactNode;
};

export function AppShell({ activeGym, currentPath, userEmail, children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-paper text-ink lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="border-b border-white/10 bg-ink p-5 text-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <Link className="flex items-center gap-3 text-lg font-black" href="/">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-lime text-ink shadow-lg shadow-brand-lime/10">
            F
          </span>
          Fit Manager
        </Link>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
          <small className="font-black uppercase tracking-[0.16em] text-brand-sand">
            Gimnasio activo
          </small>
          <strong className="mt-2 block text-xl">{activeGym.tradeName}</strong>
          <span className="mt-1 block text-sm text-gray-light">
            {activeGym.defaultCurrency} / {activeGym.timezone}
          </span>
        </div>

        <nav className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
          {nav.map(([label, href]) => (
            <Link
              aria-current={currentPath === href ? "page" : undefined}
              className={`rounded-md px-4 py-3 text-sm font-bold transition ${
                currentPath === href
                  ? "bg-brand-green text-white shadow-sm"
                  : "text-gray-light hover:bg-white/10 hover:text-white"
              }`}
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 rounded-lg border border-charcoal p-4 text-sm text-gray-light">
          <span className="block font-bold text-paper">{userEmail ?? "Usuario activo"}</span>
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

      <section className="min-w-0 bg-paper p-4 text-ink sm:p-7 lg:p-9">{children}</section>
    </main>
  );
}
