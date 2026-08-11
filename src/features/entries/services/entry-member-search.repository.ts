import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";

import type { EntryMemberSearchResultDto, FinancialAccessStatus } from "../types/entry.dto";

type Rpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

type EntryMemberSearchRow = {
  gym_member_id: string;
  member_code: string;
  full_name: string;
  status: string;
  membership_status: string | null;
  has_overdue_charges: boolean;
  financial_access_status: FinancialAccessStatus;
};

export async function searchEntryMembers(
  input: { gymId: string; search: string },
  injectedRpc?: Rpc,
): Promise<EntryMemberSearchResultDto[]> {
  const search = input.search.trim();
  if (!search) return [];

  const rpc = injectedRpc ?? await serverRpc();
  const { data, error } = await rpc("search_entry_members", {
    p_gym_id: input.gymId,
    p_search: search,
    p_limit: 10,
  });

  if (error) throw mapSupabaseError(error);

  return ((data ?? []) as EntryMemberSearchRow[]).map((row) => ({
    gymMemberId: row.gym_member_id,
    memberCode: row.member_code,
    fullName: row.full_name,
    status: row.status,
    membershipStatus: row.membership_status,
    hasOverdueCharges: row.has_overdue_charges,
    financialAccessStatus: row.financial_access_status,
  }));
}

async function serverRpc(): Promise<Rpc> {
  const supabase = await createClient();
  return async (name, args) => supabase.rpc(name as never, args as never);
}
