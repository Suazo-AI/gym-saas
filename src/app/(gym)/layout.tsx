import { redirect } from "next/navigation";

import { AppShell } from "@/features/app/components/app-shell";
import { requireUser } from "@/features/auth/services/auth.service";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";

export default async function GymLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");
  return <AppShell activeGym={activeGym} userEmail={user.email}>{children}</AppShell>;
}
