import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import type { InviteStaffInput, UpdateStaffInput } from "../schemas/staff.schema";
import type { DeletedStaffUserDto, RoleScreenAccessDto, StaffRoleDto, StaffUserDto } from "../types/staff.dto";

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

export async function listStaffUsers(gymId: string, injectedRpc?: Rpc): Promise<StaffUserDto[]> {
  const rpc = injectedRpc ?? await serverRpc();
  const { data, error } = await rpc("list_gym_staff", { p_gym_id: gymId });
  if (error) throw mapSupabaseError(error);
  return (data ?? []) as StaffUserDto[];
}

export async function listDeletedStaffUsers(gymId: string, injectedRpc?: Rpc): Promise<DeletedStaffUserDto[]> {
  const rpc = injectedRpc ?? await serverRpc();
  const { data, error } = await rpc("list_deleted_entities", {
    p_gym_id: gymId,
    p_entity: "gym_user",
    p_limit: 50,
    p_offset: 0,
  });
  if (error) throw mapSupabaseError(error);
  return ((data ?? []) as Array<{
    id: string;
    label: string;
    deleted_at?: string;
    deletedAt?: string;
    deletion_reason?: string | null;
    reason?: string | null;
  }>).map((row) => ({
    id: row.id,
    label: row.label,
    deletedAt: row.deleted_at ?? row.deletedAt ?? "",
    reason: row.deletion_reason ?? row.reason ?? null,
  }));
}

export async function listStaffRoles(gymId: string): Promise<StaffRoleDto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .select("id, code, name, description, role_permissions(permissions(code))")
    .eq("gym_id", gymId)
    .is("deleted_at", null)
    .order("name");
  if (error) throw mapSupabaseError(error);
  return mapStaffRoles(data ?? []);
}

type StaffRoleRow = Omit<StaffRoleDto, "permissionCodes"> & {
  role_permissions: Array<{ permissions: { code: string } | null }>;
};

export function mapStaffRoles(rows: StaffRoleRow[]): StaffRoleDto[] {
  return rows.map(({ role_permissions: rolePermissions, ...role }) => ({
    ...role,
    permissionCodes: rolePermissions
      .flatMap((item) => item.permissions?.code ?? [])
      .sort(),
  }));
}

export async function updateStaffUser(input: UpdateStaffInput, injectedRpc?: Rpc) {
  const rpc = injectedRpc ?? await serverRpc();
  const { data, error } = await rpc("update_gym_staff_user", {
    p_gym_id: input.gymId,
    p_gym_user_id: input.gymUserId,
    p_employee_code: input.employeeCode ?? null,
    p_status: input.status,
    p_role_ids: input.roleIds,
  });
  if (error) throw mapSupabaseError(error);
  return data;
}

export async function listRoleScreenAccess(gymId: string, injectedRpc?: Rpc): Promise<RoleScreenAccessDto> {
  const rpc=injectedRpc??await serverRpc(); const {data,error}=await rpc("list_role_screen_access",{p_gym_id:gymId}); if(error)throw mapSupabaseError(error); return data as RoleScreenAccessDto;
}
export async function updateRoleScreenAccess(input:{gymId:string;roleId:string;screenIds:string[]},injectedRpc?:Rpc){const rpc=injectedRpc??await serverRpc();const {data,error}=await rpc("update_role_screen_access",{p_gym_id:input.gymId,p_role_id:input.roleId,p_screen_ids:input.screenIds});if(error)throw mapSupabaseError(error);return data;}

export async function deleteStaffUser(
  input: { gymUserId: string; reason: string },
  injectedRpc?: Rpc,
) {
  const rpc = injectedRpc ?? await serverRpc();
  const { data, error } = await rpc("soft_delete_entity", {
    p_entity: "gym_user",
    p_id: input.gymUserId,
    p_reason: input.reason,
  });
  if (error) throw mapSupabaseError(error);
  return data;
}

export async function restoreStaffUser(gymUserId: string, injectedRpc?: Rpc) {
  const rpc = injectedRpc ?? await serverRpc();
  const { data, error } = await rpc("restore_entity", {
    p_entity: "gym_user",
    p_id: gymUserId,
  });
  if (error) throw mapSupabaseError(error);
  return data;
}

type InviteDependencies = {
  inviteUserByEmail: (email: string, options?: { redirectTo?: string }) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  deleteUser: (id: string) => Promise<unknown>;
  rpc: Rpc;
};

export async function inviteStaffUser(
  input: InviteStaffInput & { gymId: string },
  injected?: InviteDependencies,
) {
  const dependencies = injected ?? await invitationDependencies();
  const redirectTo = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`
    : undefined;
  const { data, error } = await dependencies.inviteUserByEmail(input.email, { redirectTo });
  if (error || !data.user) throw mapSupabaseError(error ?? { message: "Invitation user missing" });

  const { data: linked, error: linkError } = await dependencies.rpc("link_invited_gym_staff_user", {
    p_gym_id: input.gymId,
    p_auth_user_id: data.user.id,
    p_employee_code: input.employeeCode ?? null,
    p_role_ids: input.roleIds,
  });
  if (linkError) {
    await dependencies.deleteUser(data.user.id);
    throw mapSupabaseError(linkError);
  }
  return linked;
}

async function serverRpc(): Promise<Rpc> {
  const supabase = await createClient();
  return async (name, args) => supabase.rpc(name as never, args as never);
}

async function invitationDependencies(): Promise<InviteDependencies> {
  const admin = createAdminClient();
  return {
    inviteUserByEmail: (email, options) => admin.auth.admin.inviteUserByEmail(email, options),
    deleteUser: (id) => admin.auth.admin.deleteUser(id),
    rpc: await serverRpc(),
  };
}
