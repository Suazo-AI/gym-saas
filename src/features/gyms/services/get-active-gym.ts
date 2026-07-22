import { getUserGyms } from "./get-user-gyms";
import type { ActiveGymDto } from "../types/gym.dto";

export async function getActiveGym(): Promise<ActiveGymDto | null> {
  const gyms = await getUserGyms();
  const gym = gyms[0];

  if (!gym) {
    return null;
  }

  return {
    ...gym,
    selectionSource: gyms.length === 1 ? "single_membership" : "first_membership",
  };
}
