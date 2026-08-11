import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { FacialAccessPanel } from "@/features/faces/components/facial-access-panel";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import {
  hasGymPermission,
  requireGymPermission,
} from "@/features/gyms/services/require-gym-permission";

export default async function FacialAccessPage() {
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");

  await requireGymPermission(activeGym.gymId, "faces.read");
  const canVerify = await hasGymPermission(activeGym.gymId, "faces.verify");

  return (
    <>
      <ModuleHeader
        eyebrow="Biometría"
        title="Acceso facial"
        description="Identifica al miembro y valida su acceso sin reemplazar la revisión manual."
      />
      <FacialAccessPanel canVerify={canVerify} />
    </>
  );
}
