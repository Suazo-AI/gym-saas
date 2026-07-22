export type UserGymDto = {
  gymId: string;
  tradeName: string;
  legalName: string;
  slug: string;
  defaultCurrency: string;
  timezone: string;
  userGymId: string;
  userStatus: string;
};

export type ActiveGymDto = UserGymDto & {
  selectionSource: "single_membership" | "first_membership";
};
