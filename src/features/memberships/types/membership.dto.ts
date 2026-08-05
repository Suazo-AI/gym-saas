export type MembershipPlanDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: string;
  currency: "USD" | "NIO";
  billingCycleMonths: number;
  durationCount: number;
  durationUnit: "day" | "week" | "month";
  graceDays: number;
  autoRenew: boolean;
  isActive: boolean;
  benefits: MembershipPlanBenefitDto[];
};

export type MembershipPlanBenefitDto = {
  id: string;
  benefitCode: string;
  description: string;
};

export type DeletedMembershipPlanDto = {
  id: string;
  label: string;
  deletedAt: string;
  reason: string | null;
};
