import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

import type { BranchInput, UpdateBranchInput } from "../schemas/branch.schema";
import type { BranchDto, DeletedBranchDto } from "../types/branch.dto";

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
type CreateGateway = { insert: (values: Record<string, unknown>) => Promise<{ error: unknown }> };
type UpdateGateway = { update: (branchId: string, gymId: string, values: Record<string, unknown>) => Promise<{ error: unknown }> };

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

export async function createBranch(input: BranchInput & { gymId: string }, injected?: CreateGateway) {
  const gateway = injected ?? await createGateway();
  const { error } = await gateway.insert({ gym_id: input.gymId, code: input.code, name: input.name, city: input.city, status: input.status });
  if (error) throw mapSupabaseError(error);
}

export async function updateBranch(input: UpdateBranchInput & { gymId: string }, injected?: UpdateGateway) {
  const gateway = injected ?? await updateGateway();
  const values = { code: input.code, name: input.name, city: input.city, status: input.status };
  const { error } = await gateway.update(input.branchId, input.gymId, values);
  if (error) throw mapSupabaseError(error);
}

export async function retireBranch(input: { branchId: string; reason: string }, injectedRpc?: Rpc) {
  const rpc = injectedRpc ?? await serverRpc();
  const { data, error } = await rpc("soft_delete_entity", { p_entity: "gym_branch", p_id: input.branchId, p_reason: input.reason });
  if (error) throw mapSupabaseError(error);
  return data;
}

export async function restoreBranch(branchId: string, injectedRpc?: Rpc) {
  const rpc = injectedRpc ?? await serverRpc();
  const { data, error } = await rpc("restore_entity", { p_entity: "gym_branch", p_id: branchId });
  if (error) throw mapSupabaseError(error);
  return data;
}

export async function listDeletedBranches(gymId: string, injectedRpc?: Rpc): Promise<DeletedBranchDto[]> {
  const rpc = injectedRpc ?? await serverRpc();
  const { data, error } = await rpc("list_deleted_entities", { p_gym_id: gymId, p_entity: "gym_branch", p_limit: 50, p_offset: 0 });
  if (error) throw mapSupabaseError(error);
  return ((data ?? []) as Array<{ id: string; label: string; deleted_at?: string; deletedAt?: string; deletion_reason?: string | null; reason?: string | null }>).map((row) => ({
    id: row.id, label: row.label, deletedAt: row.deleted_at ?? row.deletedAt ?? "", reason: row.deletion_reason ?? row.reason ?? null,
  }));
}

export async function canManageBranches(gymId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return false;
  const { data, error } = await supabase
    .from("gym_users")
    .select("gym_user_roles(roles(role_permissions(permissions(code))))")
    .eq("gym_id", gymId)
    .eq("auth_user_id", authData.user.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return false;
  const serialized = JSON.stringify(data);
  return serialized.includes('"code":"gym.manage"');
}

async function createGateway(): Promise<CreateGateway> {
  const supabase = await createClient();
  return { insert: async (values) => { const { error } = await supabase.from("gym_branches").insert(values as never); return { error }; } };
}

async function updateGateway(): Promise<UpdateGateway> {
  const supabase = await createClient();
  return { update: async (branchId, gymId, values) => {
    const { error } = await supabase.from("gym_branches").update(values as never).eq("id", branchId).eq("gym_id", gymId).is("deleted_at", null);
    return { error };
  } };
}

async function serverRpc(): Promise<Rpc> {
  const supabase = await createClient();
  return async (name, args) => supabase.rpc(name as never, args as never);
}

function mapBranch(row: Pick<Tables<"gym_branches">, "id" | "code" | "name" | "city" | "status">): BranchDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    city: row.city,
    status: row.status === "active" ? "active" : "inactive",
  };
}
