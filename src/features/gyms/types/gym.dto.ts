export type UserGymDto = {
  gymId: string;
  tradeName: string;
  legalName: string;
  logoMediaAssetId?: string | null;
  logoUrl?: string | null;
  slug: string;
  defaultCurrency: string;
  timezone: string;
  userGymId: string;
  userStatus: string;
};

export type ActiveGymDto = UserGymDto & {
  selectionSource: "single_membership" | "first_membership" | "cookie";
};
