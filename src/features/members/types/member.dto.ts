export type MemberStatus = "prospect" | "active" | "inactive" | "blocked";
export type MembershipStatus = "trialing" | "active" | "past_due" | "paused" | "canceled" | "expired";

export type MemberSummaryDto = {
  gymId: string;
  gymMemberId: string;
  personId: string;
  memberCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: string;
  branchId: string | null;
  branchName: string | null;
  primaryPhotoMediaAssetId: string | null;
  membershipStatus: string | null;
  membershipPlanName: string | null;
  nextPaymentDate: string | null;
  overdueAmount: string;
  hasOverdueCharges: boolean;
  createdAt: string;
};

export type MemberDetailDto = MemberSummaryDto & {
  middleName: string | null;
  secondLastName: string | null;
  birthDate: string | null;
  sex: string | null;
  notes: string | null;
  contacts: Array<{
    id: string;
    type: string;
    value: string;
    isPrimary: boolean;
  }>;
  primaryAddress: {
    id: string;
    countryCode: string | null;
    departmentState: string | null;
    city: string | null;
    district: string | null;
    addressLine1: string;
    addressLine2: string | null;
    postalCode: string | null;
  } | null;
  currentSubscription: unknown;
  pendingCharges: unknown[];
  paymentSummary: unknown;
};

export type CreateMemberInput = {
  gymId: string;
  firstName: string;
  lastName: string;
  memberCode?: string;
  branchId?: string | null;
  phone?: string;
  email?: string;
  joinedOn?: string;
  membershipPlanId?: string | null;
  subscriptionStartDate?: string | null;
  createInitialCharge?: boolean;
  paymentMethodId?: string | null;
  paymentAmount?: string | null;
  paymentCurrency?: string | null;
  paymentPaidAt?: string | null;
  paymentNotes?: string | null;
};

export type UpdateMemberInput = Partial<Omit<CreateMemberInput, "gymId">> & {
  gymId: string;
  gymMemberId: string;
};

export type ListMembersInput = {
  gymId: string;
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  branchId?: string;
  membershipStatus?: string;
  hasOverdueCharges?: boolean;
  orderBy: "createdAt" | "fullName" | "memberCode" | "nextPaymentDate";
  orderDirection: "asc" | "desc";
};

export type PaginatedMembersDto = {
  data: MemberSummaryDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type MemberSummaryRow = {
  gym_id: string;
  gym_member_id: string;
  person_id: string;
  member_code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  status: string;
  branch_id: string | null;
  branch_name: string | null;
  primary_photo_media_asset_id: string | null;
  membership_status: string | null;
  membership_plan_name: string | null;
  next_payment_date: string | null;
  overdue_amount: string | number | null;
  has_overdue_charges: boolean | null;
  created_at: string;
};
