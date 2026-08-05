export type CurrencyTotals = { USD: string; NIO: string };

export type OwnerDashboardDto = {
  activeMembers: number | null;
  expiringMemberships: number | null;
  overdueMembers: number | null;
  income: { today: CurrencyTotals; month: CurrencyTotals } | null;
  entriesToday: number | null;
  openAlerts: number | null;
};
