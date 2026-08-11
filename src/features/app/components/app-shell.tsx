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
      <aside className="border-b border-white/10 bg-[#111814] p-5 text-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <Link className="flex items-center gap-3 text-lg font-black" href="/">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-lime text-ink shadow-lg shadow-brand-lime/10">
            F
          </span>
          Fit Manager
        </Link>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
          <ActiveGymSwitcher activeGym={activeGym} availableGyms={availableGyms} />
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
      </aside>

      <section className="min-w-0 bg-paper p-4 text-ink sm:p-7 lg:p-9">{children}</section>
    </main>
  );
}
