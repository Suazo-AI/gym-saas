import Link from "next/link";

import { signOutAction } from "@/features/auth/actions/auth.actions";
import { PreferencesControls } from "@/features/app/components/preferences-controls";

type PlatformShellProps = {
  currentPath: string;
  navigation: ReadonlyArray<{ label: string; href: string }>;
  userEmail?: string | null;
  children: React.ReactNode;
};

export function PlatformShell({ currentPath, navigation, userEmail, children }: PlatformShellProps) {
  return (
    <main className="min-h-screen bg-paper text-ink lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="border-b border-white/10 bg-[#111814] p-5 text-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <Link className="flex items-center gap-3 text-lg font-black" href="/platform">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-lime text-ink shadow-lg shadow-brand-lime/10">
            F
          </span>
          FitManager SaaS
        </Link>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
          <small className="font-black uppercase tracking-[0.16em] text-brand-sand">
            Consola interna
          </small>
          <strong className="mt-2 block text-xl">Clientes del SaaS</strong>
          <span className="mt-1 block text-sm text-gray-light">Admin de plataforma</span>
        </div>

        <nav className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {navigation.map(({ label, href }) => (
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
          <span className="block font-bold text-white">{userEmail ?? "Admin SaaS"}</span>
        </div>
        <PreferencesControls />

        <form action={signOutAction} className="mt-4">
          <button
            className="min-h-11 w-full rounded-md border border-gray-light px-4 py-3 text-sm font-bold text-white hover:bg-charcoal"
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
