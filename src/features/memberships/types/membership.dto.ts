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

export type AssignSubscriptionInput = {
  gymId: string;
  gymMemberId: string;
  membershipPlanId: string;
  startDate?: string;
  billingCycleMonths?: number;
  recurringAmount?: string;
  currency?: "USD" | "NIO";
  autoRenew?: boolean;
  generateFirstCharge?: boolean;
};

export type AssignedSubscriptionDto = {
  subscriptionId: string;
  gymMemberId: string;
  membershipPlanId: string;
  planName: string;
  status: string;
  startDate: string;
  endDate: string | null;
  billingCycleMonths: number;
  recurringAmount: string;
  currency: string;
  chargeId: string | null;
  chargeAmountDue: string | null;
  chargeDueDate: string | null;
};

export type AssignedSubscriptionRow = {
  subscriptionId: string;
  gymMemberId: string;
  membershipPlanId: string;
  planName: string;
  status: string;
  startDate: string;
  endDate: string | null;
  billingCycleMonths: number;
  recurringAmount: string;
  currency: string;
  chargeId: string | null;
  chargeAmountDue: string | null;
  chargeDueDate: string | null;
};
