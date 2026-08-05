import type {
  PendingChargeDto,
  PendingChargeRow,
  RegisteredPaymentDto,
  RegisteredPaymentRow,
} from "../types/payment.dto";

export function mapPendingChargeRow(row: PendingChargeRow): PendingChargeDto {
  return {
    gymId: row.gym_id,
    gymMemberId: row.gym_member_id,
    chargeId: row.charge_id,
    memberSubscriptionId: row.member_subscription_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    dueDate: row.due_date,
    amountDue: String(row.amount_due),
    amountPaid: String(row.amount_paid),
    amountRemaining: String(row.amount_remaining),
    currency: row.currency,
    status: row.status,
  };
}

export function mapPendingChargeRows(rows: PendingChargeRow[]): PendingChargeDto[] {
  return rows.map(mapPendingChargeRow);
}

export function mapRegisteredPayment(row: RegisteredPaymentRow): RegisteredPaymentDto {
  return {
    paymentId: row.paymentId,
    receiptNumber: row.receiptNumber,
    amount: String(row.amount),
    currency: row.currency,
    paidAt: row.paidAt,
    allocations: row.allocations.map((allocation) => ({
      chargeId: allocation.chargeId,
      amount: String(allocation.amount),
      chargeStatus: allocation.chargeStatus,
    })),
    remainingBalance: String(row.remainingBalance),
  };
}
