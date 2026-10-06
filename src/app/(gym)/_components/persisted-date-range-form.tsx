"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const controlClass = "field";

type PersistedDateRangeFormProps = {
  from?: string;
  to?: string;
  storageKey: string;
};

export function PersistedDateRangeForm(props: PersistedDateRangeFormProps) {
  return (
    <PersistedDateRangeFields
      {...props}
      key={`${props.from ?? ""}:${props.to ?? ""}`}
    />
  );
}

function PersistedDateRangeFields({
  from = "",
  to = "",
  storageKey,
}: PersistedDateRangeFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [values, setValues] = useState({ from, to });

  useEffect(() => {
    if (from || to) return;
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as { from?: string; to?: string };
      const next = { from: parsed.from ?? "", to: parsed.to ?? "" };
      router.replace(buildDateRangeHref(pathname, searchParams.toString(), next), { scroll: false });
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [from, pathname, router, searchParams, storageKey, to]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem(storageKey, JSON.stringify(values));
    router.replace(buildDateRangeHref(pathname, searchParams.toString(), values), { scroll: false });
  }

  function clear() {
    const empty = { from: "", to: "" };
    setValues(empty);
    window.localStorage.removeItem(storageKey);
    router.replace(buildDateRangeHref(pathname, searchParams.toString(), empty), { scroll: false });
  }

  return (
    <form className="grid grid-cols-2 gap-3 border-b border-line p-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end" onSubmit={submit}>
      <label className="field-label">
        Desde
        <input
          className={controlClass}
          max={values.to || undefined}
          name="from"
          onChange={(event) => setValues((current) => ({ ...current, from: event.target.value }))}
          type="date"
          value={values.from}
        />
      </label>
      <label className="field-label">
        Hasta
        <input
          className={controlClass}
          min={values.from || undefined}
          name="to"
          onChange={(event) => setValues((current) => ({ ...current, to: event.target.value }))}
          type="date"
          value={values.to}
        />
      </label>
      <button className="btn btn-secondary" type="submit">
        Filtrar
      </button>
      <button className="btn btn-quiet" onClick={clear} type="button">
        Limpiar
      </button>
    </form>
  );
}

export function buildDateRangeHref(
  pathname: string,
  current: string,
  values: { from: string; to: string },
) {
  const params = new URLSearchParams(current);
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
