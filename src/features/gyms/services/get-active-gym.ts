import { cookies } from "next/headers";
import { cache } from "react";

import { getUserGyms } from "./get-user-gyms";
import type { ActiveGymDto, UserGymDto } from "../types/gym.dto";

export const ACTIVE_GYM_COOKIE = "fitmanager-active-gym";

export function resolveActiveGym(
  gyms: UserGymDto[],
  selectedGymId?: string | null,
): ActiveGymDto | null {
  const firstGym = gyms[0];
  if (!firstGym) return null;

  if (gyms.length === 1) {
    return { ...firstGym, selectionSource: "single_membership" };
  }

  const selectedGym = selectedGymId
    ? gyms.find((gym) => gym.gymId === selectedGymId)
    : undefined;

  return selectedGym
    ? { ...selectedGym, selectionSource: "cookie" }
    : { ...firstGym, selectionSource: "first_membership" };
}

export const getActiveGym = cache(async (): Promise<ActiveGymDto | null> => {
  const gyms = await getUserGyms();
  const cookieStore = await cookies();
  return resolveActiveGym(gyms, cookieStore.get(ACTIVE_GYM_COOKIE)?.value);
});
