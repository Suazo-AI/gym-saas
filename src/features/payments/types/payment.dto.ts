export type PaymentSummaryDto = {
  id: string;
  gymMemberId: string;
  amount: string;
  currency: string;
  status: string;
  receiptNumber: string | null;
  paidAt: string;
};

export type PaymentMethodDto = {
  id: string;
  code: string;
  name: string;
  isCash: boolean;
};

export type PendingChargeDto = {
  gymId: string;
  gymMemberId: string;
  chargeId: string;
  memberSubscriptionId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amountDue: string;
  amountPaid: string;
  amountRemaining: string;
  currency: string;
  status: string;
};

export type PaymentAllocationInput = {
  chargeId: string;
  amount: string;
};

export type RegisterPaymentInput = {
  gymId: string;
  gymMemberId: string;
  paymentMethodId: string;
  amount: string;
  currency: "USD" | "NIO";
  allocations: PaymentAllocationInput[];
  branchId?: string | null;
  paidAt?: string | null;
  externalReference?: string | null;
  notes?: string | null;
};

export type RegisteredPaymentDto = {
  paymentId: string;
  receiptNumber: string;
  amount: string;
  currency: string;
  paidAt: string;
  allocations: Array<{
    chargeId: string;
    amount: string;
    chargeStatus: string;
  }>;
  remainingBalance: string;
};

export type PendingChargeRow = {
  gym_id: string;
  gym_member_id: string;
  charge_id: string;
  member_subscription_id: string;
  period_start: string;
  period_end: string;
  due_date: string;
  amount_due: string | number;
  amount_paid: string | number;
  amount_remaining: string | number;
  currency: string;
  status: string;
};

export type RegisteredPaymentRow = {
  paymentId: string;
  receiptNumber: string;
  amount: string | number;
  currency: string;
  paidAt: string;
  allocations: Array<{
    chargeId: string;
    amount: string | number;
    chargeStatus: string;
  }>;
  remainingBalance: string | number;
};
