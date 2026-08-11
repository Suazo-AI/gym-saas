import { redirect } from "next/navigation";

import { requireUser } from "@/features/auth/services/auth.service";

export type PlatformMetadata = { platform_role?: unknown };

export const platformNavigation = [
  { label: "Resumen", href: "/platform" },
  { label: "Gimnasios", href: "/platform/gyms" },
  { label: "Suscripciones", href: "/platform/subscriptions" },
  { label: "Facturas", href: "/platform/invoices" },
  { label: "Pagos", href: "/platform/payments" },
  { label: "Auditoría", href: "/platform/audit" },
] as const;

export function hasPlatformAccess(metadata: PlatformMetadata): boolean {
  return metadata.platform_role === "admin";
}

export function getPlatformNavigation(metadata: PlatformMetadata) {
  return hasPlatformAccess(metadata) ? [...platformNavigation] : [];
}

export async function requirePlatformAdmin() {
  const user = await requireUser();
  const metadata = user.app_metadata as PlatformMetadata;
  if (!hasPlatformAccess(metadata)) return redirect("/dashboard");
  return { user, navigation: getPlatformNavigation(metadata) };
}
