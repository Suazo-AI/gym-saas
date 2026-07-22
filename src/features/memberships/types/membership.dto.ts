export type MembershipPlanDto = {
  id: string;
  code: string;
  name: string;
  price: string;
  currency: string;
  billingCycleMonths: number;
  graceDays: number;
  isActive: boolean;
};
