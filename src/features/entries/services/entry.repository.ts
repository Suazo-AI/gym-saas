import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

import type { EntryEventDto } from "../types/entry.dto";

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
