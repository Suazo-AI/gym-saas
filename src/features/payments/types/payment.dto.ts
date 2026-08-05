export type PaymentSummaryDto = {
  id: string;
  gymMemberId: string;
  amount: string;
  currency: string;
  status: string;
  receiptNumber: string | null;
  paidAt: string;
  appliedNioPerUsd: string;
};

export type PaymentMethodDto = {
  id: string;
  code: string;
  name: string;
  isCash: boolean;
};

export type PayableChargeDto = { chargeId: string; gymMemberId: string; memberLabel: string; dueDate: string; amountDue: string; currency: string; status: string };
