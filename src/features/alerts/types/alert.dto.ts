export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved" | "dismissed";

export type GymAlertDto = {
  id: string;
  alertTypeCode: string;
  alertTypeName: string;
  gymMemberId: string | null;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
};
