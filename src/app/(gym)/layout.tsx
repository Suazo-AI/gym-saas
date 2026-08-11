import { redirect } from "next/navigation";

import { AppShell } from "@/features/app/components/app-shell";
import { requireUser } from "@/features/auth/services/auth.service";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { getUserGyms } from "@/features/gyms/services/get-user-gyms";

export default async function GymLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, activeGym, availableGyms] = await Promise.all([
    requireUser(),
    getActiveGym(),
    getUserGyms(),
  ]);
  if (!activeGym) redirect("/login");
  return <AppShell activeGym={activeGym} availableGyms={availableGyms} userEmail={user.email}>{children}</AppShell>;
}
