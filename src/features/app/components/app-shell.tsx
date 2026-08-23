import Link from "next/link";

import { signOutAction } from "@/features/auth/actions/auth.actions";
import { ActiveGymSwitcher } from "@/features/gyms/components/active-gym-switcher";
import type { ActiveGymDto, UserGymDto } from "@/features/gyms/types/gym.dto";
import { listCurrentUserScreens } from "../services/navigation.repository";
import { LocalizedNav, PreferencesControls } from "./preferences-controls";

const supportedRoutes = new Set(["/dashboard","/members","/memberships","/payments","/entries","/facial-access","/alerts","/income","/staff","/settings"]);

type AppShellProps = {
  activeGym: ActiveGymDto;
  availableGyms: UserGymDto[];
  currentPath?: string;
  userEmail?: string | null;
  children: React.ReactNode;
};

export async function AppShell({ activeGym, availableGyms, currentPath, userEmail, children }: AppShellProps) {
  const screens=await listCurrentUserScreens(activeGym.gymId).catch(()=>[]);
  const nav=screens.filter((screen)=>supportedRoutes.has(screen.route));
  return (
    <main className="min-h-screen bg-paper text-ink lg:grid lg:grid-cols-[272px_1fr]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#111814] px-4 py-3 text-white lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <BrandLink />
          <details className="group relative">
            <summary
              aria-label="Abrir menu principal"
              className="flex min-h-11 cursor-pointer list-none items-center rounded-md border border-white/20 px-4 text-sm font-black hover:bg-white/10"
            >
              Menú
            </summary>
            <div className="absolute right-0 top-[calc(100%+0.75rem)] max-h-[calc(100vh-5.5rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-white/10 bg-[#111814] p-4 shadow-2xl">
              <ShellControls
                activeGym={activeGym}
                availableGyms={availableGyms}
                currentPath={currentPath}
                nav={nav}
                selectId="mobile-active-gym-select"
                userEmail={userEmail}
              />
            </div>
          </details>
        </div>
      </header>

      <aside className="hidden border-r border-white/10 bg-[#111814] p-5 text-white lg:block lg:min-h-screen">
        <BrandLink />
        <ShellControls
          activeGym={activeGym}
          availableGyms={availableGyms}
          currentPath={currentPath}
          nav={nav}
          selectId="desktop-active-gym-select"
          userEmail={userEmail}
        />
      </aside>

      <section className="min-w-0 bg-paper p-4 text-ink sm:p-7 lg:p-9">{children}</section>
    </main>
  );
}

function BrandLink() {
  return (
    <Link className="flex items-center gap-3 text-lg font-black" href="/">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-lime text-ink shadow-lg shadow-brand-lime/10">
        F
      </span>
      Fit Manager
    </Link>
  );
}

function ShellControls({
  activeGym,
  availableGyms,
  currentPath,
  nav,
  selectId,
  userEmail,
}: {
  activeGym: ActiveGymDto;
  availableGyms: UserGymDto[];
  currentPath?: string;
  nav: Array<{ code: string; name: string; route: string }>;
  selectId: string;
  userEmail?: string | null;
}) {
  return (
    <>
      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
        <ActiveGymSwitcher activeGym={activeGym} availableGyms={availableGyms} selectId={selectId} />
      </div>

      <LocalizedNav currentPath={currentPath} screens={nav} />

      <div className="mt-8 rounded-lg border border-charcoal p-4 text-sm text-gray-light">
        <span className="block font-bold text-white">{userEmail ?? "Usuario activo"}</span>
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
    </>
  );
}
