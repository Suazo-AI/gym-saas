"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  type ActiveGymActionState,
  switchActiveGymAction,
} from "../actions/active-gym.actions";
import type { ActiveGymDto, UserGymDto } from "../types/gym.dto";

export function ActiveGymSwitcher({
  activeGym,
  availableGyms,
  selectId = "active-gym-select",
}: {
  activeGym: ActiveGymDto;
  availableGyms: UserGymDto[];
  selectId?: string;
}) {
  const [state, action] = useActionState<ActiveGymActionState, FormData>(
    switchActiveGymAction,
    null,
  );

  if (availableGyms.length < 2) {
    return <GymIdentity activeGym={activeGym} />;
  }

  return (
    <div>
      <small className="type-eyebrow block">
        Gimnasio activo
      </small>
      <form action={action} className="mt-2">
        <GymSelect activeGymId={activeGym.gymId} gyms={availableGyms} selectId={selectId} />
      </form>
      <p aria-live="polite" className="mt-1 min-h-4 text-xs font-semibold text-stop">
        {state?.error ? <span role="alert">{state.error}</span> : null}
      </p>
      <span className="block text-xs text-muted">
        {activeGym.defaultCurrency} · {activeGym.timezone}
      </span>
    </div>
  );
}

function GymIdentity({ activeGym }: { activeGym: ActiveGymDto }) {
  return (
    <div>
      <small className="type-eyebrow block">
        Gimnasio activo
      </small>
      <strong className="mt-1 block text-sm font-semibold text-ink">{activeGym.tradeName}</strong>
      <span className="mt-0.5 block text-xs text-muted">
        {activeGym.defaultCurrency} · {activeGym.timezone}
      </span>
    </div>
  );
}

function GymSelect({ activeGymId, gyms, selectId }: { activeGymId: string; gyms: UserGymDto[]; selectId: string }) {
  const { pending } = useFormStatus();

  return (
    <>
      <label className="sr-only" htmlFor={selectId}>Cambiar gimnasio activo</label>
      <select
        aria-label="Cambiar gimnasio activo"
        className="field mt-1.5 min-h-10 text-sm font-semibold"
        defaultValue={activeGymId}
        disabled={pending}
        id={selectId}
        name="gymId"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {gyms.map((gym) => (
          <option key={gym.gymId} value={gym.gymId}>{gym.tradeName}</option>
        ))}
      </select>
      {pending ? <span className="mt-1 block text-xs text-muted">Cambiando gimnasio...</span> : null}
    </>
  );
}
