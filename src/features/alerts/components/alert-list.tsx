"use client";

import { useActionState } from "react";

import { acknowledgeAlertAction, resolveAlertAction, type AlertActionState } from "../actions/alert.actions";
import type { GymAlertDto } from "../types/alert.dto";

const initialState: AlertActionState = { ok: false };
const dateFormatter = new Intl.DateTimeFormat("es-NI", { dateStyle: "medium", timeStyle: "short" });
const severityStyles = {
  info: "bg-blue-50 text-blue-800",
  warning: "bg-amber-50 text-amber-900",
  critical: "bg-red-50 text-red-800",
};
const severityLabels = { info: "Informativa", warning: "Advertencia", critical: "Critica" };
const statusLabels = { open: "Abierta", acknowledged: "Reconocida", resolved: "Resuelta", dismissed: "Descartada" };

export function AlertList({ alerts }: { alerts: GymAlertDto[] }) {
  if (alerts.length === 0) {
    return <p className="p-5 text-gray">No hay alertas con este estado.</p>;
  }

  return <div className="divide-y divide-slate-200">{alerts.map((alert) => <AlertRow alert={alert} key={alert.id} />)}</div>;
}

function AlertRow({ alert }: { alert: GymAlertDto }) {
  const action = alert.status === "open" ? acknowledgeAlertAction : resolveAlertAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const canTransition = alert.status === "open" || alert.status === "acknowledged";

  return (
    <article className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-black ${severityStyles[alert.severity]}`}>
            {severityLabels[alert.severity]}
          </span>
          <span className="text-xs font-bold uppercase tracking-wide text-gray">{statusLabels[alert.status]}</span>
          <span className="text-xs text-gray">{alert.alertTypeName}</span>
        </div>
        <h2 className="mt-3 text-lg font-black text-ink">{alert.title}</h2>
        <p className="mt-1 text-sm text-gray">{alert.message}</p>
        <time className="mt-2 block text-xs text-gray" dateTime={alert.createdAt}>
          {dateFormatter.format(new Date(alert.createdAt))}
        </time>
        {state.message ? <p className={`mt-2 text-sm font-bold ${state.ok ? "text-green-700" : "text-red-700"}`} role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
      </div>
      {canTransition ? (
        <form action={formAction}>
          <input name="alertId" type="hidden" value={alert.id} />
          <button className="min-h-11 rounded-lg bg-ink px-4 py-2 text-sm font-black text-white disabled:opacity-60" disabled={pending}>
            {pending ? "Guardando..." : alert.status === "open" ? "Reconocer" : "Resolver"}
          </button>
        </form>
      ) : null}
    </article>
  );
}
