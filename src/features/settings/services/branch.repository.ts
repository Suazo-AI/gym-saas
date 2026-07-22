import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

import type { BranchDto } from "../types/branch.dto";

export async function listBranches(gymId: string): Promise<BranchDto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gym_branches")
    .select("id, code, name, city, status")
    .eq("gym_id", gymId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    throw mapSupabaseError(error);
  }

  return (data ?? []).map(mapBranch);
}

function mapBranch(row: Pick<Tables<"gym_branches">, "id" | "code" | "name" | "city" | "status">): BranchDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    city: row.city,
    status: row.status,
  };
}
