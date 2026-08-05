export type BranchDto = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  status: "active" | "inactive";
};

export type DeletedBranchDto = {
  id: string;
  label: string;
  deletedAt: string;
  reason: string | null;
};
