"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutAction } from "@/features/auth/actions/auth.actions";
import { PreferencesControls } from "@/features/app/components/preferences-controls";

type PlatformShellProps = {
  currentPath?: string;
  navigation: ReadonlyArray<{ label: string; href: string }>;
  userEmail?: string | null;
  children: React.ReactNode;
};

export function PlatformShell({ currentPath, navigation, userEmail, children }: PlatformShellProps) {
  const pathname = usePathname();
  const activePath = pathname || currentPath;

  return (
    <main className="min-h-screen bg-canvas text-ink lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="border-b border-line bg-surface p-5 text-ink lg:min-h-screen lg:border-b-0 lg:border-r">
        <Link className="flex items-center gap-3 text-lg font-black" href="/platform">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-accent-ink">
            F
          </span>
          FitManager SaaS
        </Link>

        <div className="mt-8 rounded-xl border border-line bg-fill p-4">
          <small className="type-eyebrow text-muted">
            Consola interna
          </small>
          <strong className="mt-2 block text-xl">Clientes del SaaS</strong>
          <span className="mt-1 block text-sm text-muted">Admin de plataforma</span>
        </div>

        <nav className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {navigation.map(({ label, href }) => (
            <Link
              aria-current={activePath === href ? "page" : undefined}
              className={`rounded-md px-4 py-3 text-sm font-bold transition ${
                activePath === href
                  ? "bg-accent-tint text-ink"
                  : "text-ink-2 hover:bg-fill"
              }`}
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 rounded-lg border border-line p-4 text-sm text-muted">
          <span className="block break-words font-bold text-ink">{userEmail ?? "Admin SaaS"}</span>
        </div>
        <PreferencesControls />

        <form action={signOutAction} className="mt-4">
          <button
            className="btn btn-quiet w-full px-4 py-3 text-sm"
            type="submit"
          >
            Cerrar sesion
          </button>
        </form>
      </aside>

      <section className="min-w-0 bg-canvas p-5 text-ink sm:p-8">{children}</section>
    </main>
  );
}
