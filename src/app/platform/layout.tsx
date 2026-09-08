import { PlatformShell } from "@/features/platform/components/platform-shell";
import { requirePlatformAdmin } from "@/features/platform/services/platform-access";

export default async function PlatformLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, navigation } = await requirePlatformAdmin();

  return (
    <PlatformShell navigation={navigation} userEmail={user.email}>
      {children}
    </PlatformShell>
  );
}
