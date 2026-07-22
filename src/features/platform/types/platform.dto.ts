export type PlatformMetricDto = {
  totalGyms: number;
  activeGyms: number;
  trialingSubscriptions: number;
  activeSubscriptions: number;
  pastDueSubscriptions: number;
  openInvoices: number;
  overdueInvoices: number;
  settledSaasPayments: string;
};

export type PlatformGymDto = {
  gymId: string;
  tradeName: string;
  legalName: string;
  slug: string;
  status: string;
  defaultCurrency: string;
  timezone: string;
  createdAt: string;
  subscriptionStatus: string | null;
  saasPlanName: string | null;
  currentPeriodEnd: string | null;
  branchCount: number;
  memberCount: number;
  staffCount: number;
};

export type PlatformSubscriptionDto = {
  subscriptionId: string;
  gymId: string;
  gymName: string;
  planName: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
};

export type PlatformInvoiceDto = {
  invoiceId: string;
  gymId: string;
  gymName: string;
  invoiceNumber: string;
  status: string;
  currency: string;
  totalAmount: string;
  amountPaid: string;
  dueAt: string | null;
  createdAt: string;
};

export type PlatformPaymentDto = {
  paymentId: string;
  gymId: string;
  gymName: string;
  status: string;
  amount: string;
  currency: string;
  provider: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type PlatformAuditLogDto = {
  auditLogId: number;
  gymId: string | null;
  gymName: string | null;
  actorUserId: string | null;
  action: string;
  entityTable: string;
  entityId: string | null;
  occurredAt: string;
};

export type PlatformDashboardDto = {
  metrics: PlatformMetricDto;
  gyms: PlatformGymDto[];
  subscriptions: PlatformSubscriptionDto[];
  invoices: PlatformInvoiceDto[];
  payments: PlatformPaymentDto[];
  auditLogs: PlatformAuditLogDto[];
};

export type PlatformGymDetailDto = {
  gym: {
    id: string;
    trade_name: string;
    legal_name: string;
    slug: string;
    status: string;
    default_currency: string;
    timezone: string;
    created_at: string;
  };
  subscription: {
    subscriptionId: string;
    status: string;
    planName: string;
    planPrice: string;
    planCurrency: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  branches: Array<{
    id: string;
    code: string;
    name: string;
    city: string | null;
    status: string;
    createdAt: string;
  }>;
  staff: Array<{
    gymUserId: string;
    authUserId: string;
    employeeCode: string | null;
    status: string;
    roles: string[];
    createdAt: string;
  }>;
  memberCount: number;
  recentAuditLogs: Array<{
    auditLogId: number;
    action: string;
    entityTable: string;
    entityId: string | null;
    occurredAt: string;
  }>;
};
