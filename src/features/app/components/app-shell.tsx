import Link from "next/link";
import Image from "next/image";

import { signOutAction } from "@/features/auth/actions/auth.actions";
import { ActiveGymSwitcher } from "@/features/gyms/components/active-gym-switcher";
import type { ActiveGymDto, UserGymDto } from "@/features/gyms/types/gym.dto";
import { listCurrentUserScreens } from "../services/navigation.repository";
import { LocalizedNav, PreferencesControls } from "./preferences-controls";
import { ShellSearch } from "./shell-search";

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
  const canSearchMembers=nav.some((screen)=>screen.route==="/entries");
  const canCreateMembers=nav.some((screen)=>screen.route==="/members");
  return (
    <main className="min-h-screen bg-canvas text-ink lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <header className="material sticky top-0 z-40 border-b border-line px-4 py-3 print:hidden lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <BrandLink gym={activeGym} />
          <details className="group relative">
            <summary
              aria-label="Abrir menu principal"
              className="btn btn-secondary cursor-pointer list-none px-4 [&::-webkit-details-marker]:hidden"
            >
              Menú
            </summary>
            <div className="rise-in absolute right-0 top-[calc(100%+0.5rem)] max-h-[calc(100dvh-5.5rem)] w-[min(20rem,calc(100vw-2rem))] origin-top-right overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-lg)]">
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
        {canSearchMembers ? <ShellSearch canCreateMembers={canCreateMembers} className="mt-3 flex items-center gap-2" /> : null}
      </header>

      <aside className="hidden border-r border-line bg-surface print:hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto lg:p-4">
        <div className="px-2 pt-1">
          <BrandLink gym={activeGym} />
        </div>
        <ShellControls
          activeGym={activeGym}
          availableGyms={availableGyms}
          currentPath={currentPath}
          nav={nav}
          selectId="desktop-active-gym-select"
          userEmail={userEmail}
        />
      </aside>

      <div className="min-w-0">
        {canSearchMembers ? (
          <ShellSearch canCreateMembers={canCreateMembers} className="material sticky top-0 z-30 hidden items-center gap-2 border-b border-line px-9 py-3 print:hidden lg:flex" />
        ) : null}
        <section className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-6 sm:px-7 lg:px-9 lg:pt-8">{children}</section>
      </div>
    </main>
  );
}

function BrandLink({ gym }: { gym: ActiveGymDto }) {
  return (
    <Link className="flex min-w-0 items-center gap-3" href="/dashboard">
      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-accent font-display text-base font-extrabold text-accent-ink">
        {gym.logoUrl ? <Image alt={`Logo de ${gym.tradeName}`} className="size-9 object-cover" height={36} src={gym.logoUrl} unoptimized width={36} /> : gym.tradeName.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-[0.95rem] font-bold leading-tight tracking-[-0.01em]">{gym.tradeName}</span>
        <span className="block text-xs text-muted">Fit Manager</span>
      </span>
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
      <div className="mt-5 rounded-xl border border-line bg-fill p-3">
        <ActiveGymSwitcher activeGym={activeGym} availableGyms={availableGyms} selectId={selectId} />
      </div>

      <LocalizedNav currentPath={currentPath} screens={nav} />

      <div className="mt-6 border-t border-line pt-4 lg:mt-auto">
        <span className="block truncate px-2 text-sm font-semibold text-ink">{userEmail ?? "Usuario activo"}</span>
        <PreferencesControls />
        <form action={signOutAction} className="mt-2">
          <button className="btn btn-quiet w-full justify-start px-2 text-sm" type="submit">
            Cerrar sesion
          </button>
        </form>
      </div>
    </>
  );
}
