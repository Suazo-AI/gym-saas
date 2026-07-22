export type StaffUserDto = {
  id: string;
  authUserId: string;
  employeeCode: string | null;
  status: string;
  invitedAt: string;
  acceptedAt: string | null;
};
