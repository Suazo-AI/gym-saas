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
}: {
  activeGym: ActiveGymDto;
  availableGyms: UserGymDto[];
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
      <small className="font-black uppercase tracking-[0.16em] text-brand-sand">
        Gimnasio activo
      </small>
      <form action={action} className="mt-2">
        <GymSelect activeGymId={activeGym.gymId} gyms={availableGyms} />
      </form>
      <p aria-live="polite" className="mt-2 min-h-5 text-xs font-semibold text-gray-light">
        {state?.error ? <span role="alert">{state.error}</span> : null}
      </p>
      <span className="block text-sm text-gray-light">
        {activeGym.defaultCurrency} / {activeGym.timezone}
      </span>
    </div>
  );
}

function GymIdentity({ activeGym }: { activeGym: ActiveGymDto }) {
  return (
    <div>
      <small className="font-black uppercase tracking-[0.16em] text-brand-sand">
        Gimnasio activo
      </small>
      <strong className="mt-2 block text-xl">{activeGym.tradeName}</strong>
      <span className="mt-1 block text-sm text-gray-light">
        {activeGym.defaultCurrency} / {activeGym.timezone}
      </span>
    </div>
  );
}

function GymSelect({ activeGymId, gyms }: { activeGymId: string; gyms: UserGymDto[] }) {
  const { pending } = useFormStatus();

  return (
    <>
      <label className="sr-only" htmlFor="active-gym-select">Cambiar gimnasio activo</label>
      <select
        aria-label="Cambiar gimnasio activo"
        className="min-h-11 w-full rounded-md border border-white/20 bg-[#111814] px-3 text-sm font-black text-white outline-none focus:border-brand-lime focus:ring-2 focus:ring-brand-lime/30"
        defaultValue={activeGymId}
        disabled={pending}
        id="active-gym-select"
        name="gymId"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {gyms.map((gym) => (
          <option key={gym.gymId} value={gym.gymId}>{gym.tradeName}</option>
        ))}
      </select>
      {pending ? <span className="mt-2 block text-xs text-brand-sand">Cambiando gimnasio...</span> : null}
    </>
  );
}
