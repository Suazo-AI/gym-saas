export type StaffRoleDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

export type StaffUserDto = {
  id: string;
  authUserId: string;
  email: string | null;
  fullName: string | null;
  employeeCode: string | null;
  status: "invited" | "active" | "suspended" | "revoked";
  invitedAt: string;
  acceptedAt: string | null;
  roles: Array<Pick<StaffRoleDto, "id" | "code" | "name">>;
  permissions: string[];
};

export type RoleScreenAccessDto = {
  screens: Array<{ id: string; code: string; name: string; route: string; permissionCodes: string[] }>;
  roles: Array<{ id: string; code: string; name: string; isOwner: boolean; screenIds: string[]; permissionCodes: string[] }>;
};
