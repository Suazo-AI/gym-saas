export type DailyIncomeDto = {
  gymId: string | null;
  incomeDate: string | null;
  totalIncome: string;
  currency: string | null;
};

export type MonthlyIncomeDto = {
  gymId: string;
  incomeMonth: string;
  totalIncome: string;
  currency: string;
};

export type IncomeCategoryDto = {
  id: string;
  code: string;
  name: string;
  isMembershipRelated: boolean;
};

export type IncomeBranchDto = {
  id: string;
  name: string;
};

export type IncomeRange = {
  from?: string;
  to?: string;
  currency?: "NIO" | "USD";
};

export type RecordOtherIncomeInput = {
  gymId: string;
  incomeCategoryId: string;
  amount: string;
  currency: "NIO" | "USD";
  branchId?: string | null;
  reference?: string | null;
  description?: string | null;
};
