import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

import type { StaffUserDto } from "../types/staff.dto";

export async function listStaffUsers(gymId: string): Promise<StaffUserDto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gym_users")
    .select("id, auth_user_id, employee_code, status, invited_at, accepted_at")
    .eq("gym_id", gymId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw mapSupabaseError(error);
  }

  return (data ?? []).map(mapStaffUser);
}

function mapStaffUser(row: Pick<
  Tables<"gym_users">,
  "id" | "auth_user_id" | "employee_code" | "status" | "invited_at" | "accepted_at"
>): StaffUserDto {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    employeeCode: row.employee_code,
    status: row.status,
    invitedAt: row.invited_at,
    acceptedAt: row.accepted_at,
  };
}
