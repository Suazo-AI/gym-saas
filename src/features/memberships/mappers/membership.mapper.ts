import type {
  AssignedSubscriptionDto,
  AssignedSubscriptionRow,
} from "../types/membership.dto";

export function mapAssignedSubscription(
  row: AssignedSubscriptionRow,
): AssignedSubscriptionDto {
  return {
    subscriptionId: row.subscriptionId,
    gymMemberId: row.gymMemberId,
    membershipPlanId: row.membershipPlanId,
    planName: row.planName,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    billingCycleMonths: row.billingCycleMonths,
    recurringAmount: String(row.recurringAmount),
    currency: row.currency,
    chargeId: row.chargeId,
    chargeAmountDue:
      row.chargeAmountDue === null ? null : String(row.chargeAmountDue),
    chargeDueDate: row.chargeDueDate,
  };
}
