import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

import { mapMemberEntryRows, mapRegisteredEntry } from "../mappers/entry.mapper";
import { registerEntrySchema } from "../schemas/entry.schema";
import type {
  EntryEventDto,
  MemberEntryDto,
  MemberEntryRow,
  RegisteredEntryDto,
  RegisteredEntryRow,
  RegisterEntryInput,
} from "../types/entry.dto";

type EntryQueryResult<T> = Promise<{ data: T | null; error: unknown }>;

type EntryViewQuery<T> = {
  select: (columns: string) => EntryViewQuery<T>;
  eq: (column: string, value: unknown) => EntryViewQuery<T>;
  order: (column: string, options?: { ascending?: boolean }) => EntryViewQuery<T>;
  limit: (value: number) => EntryQueryResult<T[]>;
};

type EntryViewsClient = {
  from: <T>(relation: string) => EntryViewQuery<T>;
};

export async function registerMemberEntry(input: RegisterEntryInput): Promise<RegisteredEntryDto> {
  const parsed = registerEntrySchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_member_entry" as never, {
    p_gym_id: parsed.gymId,
    p_gym_member_id: parsed.gymMemberId,
    p_branch_id: parsed.branchId ?? null,
    p_override_reason: parsed.overrideReason ?? null,
  } as never);

  if (error) {
    throw mapSupabaseError(error);
  }

  return mapRegisteredEntry(data as unknown as RegisteredEntryRow);
}

export async function listGymEntries(gymId: string, limit = 20): Promise<MemberEntryDto[]> {
  const supabase = (await createClient()) as unknown as EntryViewsClient;
  const { data, error } = await supabase
    .from<MemberEntryRow>("v_gym_entries")
    .select("*")
    .eq("gym_id", gymId)
    .order("occurred_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));

  if (error) {
    throw mapSupabaseError(error);
  }

  return mapMemberEntryRows(data ?? []);
}

export async function listRecentEntryEvents(gymId: string, limit = 20): Promise<EntryEventDto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("face_recognition_events")
    .select("id, gym_member_id, decision, decision_reason, occurred_at")
    .eq("gym_id", gymId)
    .order("occurred_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));

  if (error) {
    throw mapSupabaseError(error);
  }

  return (data ?? []).map(mapEntry);
}

function mapEntry(row: Pick<
  Tables<"face_recognition_events">,
  "id" | "gym_member_id" | "decision" | "decision_reason" | "occurred_at"
>): EntryEventDto {
  return {
    id: row.id,
    gymMemberId: row.gym_member_id,
    decision: row.decision,
    decisionReason: row.decision_reason,
    occurredAt: row.occurred_at,
  };
}
