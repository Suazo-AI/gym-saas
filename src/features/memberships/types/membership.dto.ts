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
