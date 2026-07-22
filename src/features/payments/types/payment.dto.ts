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
