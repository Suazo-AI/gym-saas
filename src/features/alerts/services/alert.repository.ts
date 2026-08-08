import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";

import type { AlertStatus, GymAlertDto } from "../types/alert.dto";

type AlertRow = {
  id: string;
  gym_member_id: string | null;
  severity: GymAlertDto["severity"];
  status: AlertStatus;
  title: string;
  message: string;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  alert_types: { code: string; name: string } | null;
};

export async function listGymAlerts(gymId: string, status?: AlertStatus): Promise<GymAlertDto[]> {
  const supabase = await createClient();
  let query = supabase
    .from("gym_alerts")
    .select("id, gym_member_id, severity, status, title, message, created_at, acknowledged_at, resolved_at, alert_types(code, name)")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw mapSupabaseError(error);

  return ((data ?? []) as unknown as AlertRow[]).map((row) => ({
    id: row.id,
    alertTypeCode: row.alert_types?.code ?? "UNKNOWN",
    alertTypeName: row.alert_types?.name ?? "Alerta",
    gymMemberId: row.gym_member_id,
    severity: row.severity,
    status: row.status,
    title: row.title,
    message: row.message,
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
  }));
}

export async function transitionGymAlert(input: {
  gymId: string;
  alertId: string;
  status: "acknowledged" | "resolved";
}) {
  const supabase = await createClient();
  const actor = await supabase.auth.getUser();
  if (actor.error || !actor.data.user) throw mapSupabaseError(actor.error ?? { message: "Missing user" });

  const timestamp = new Date().toISOString();
  const changes = input.status === "acknowledged"
    ? { status: input.status, acknowledged_at: timestamp, acknowledged_by: actor.data.user.id }
    : { status: input.status, resolved_at: timestamp, resolved_by: actor.data.user.id };

  const { data, error } = await supabase
    .from("gym_alerts")
    .update(changes)
    .eq("id", input.alertId)
    .eq("gym_id", input.gymId)
    .select("id")
    .maybeSingle();

  if (error) throw mapSupabaseError(error);
  if (!data) throw mapSupabaseError({ message: "Alert not found or update not permitted", code: "P0002" });
}
