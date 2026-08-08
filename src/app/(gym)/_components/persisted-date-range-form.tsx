"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const controlClass = "mt-1 min-h-11 rounded-md border border-gray bg-paper px-3 text-ink outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-sand";

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
    <form className="grid gap-3 border-b border-gray p-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end" onSubmit={submit}>
      <label className="grid text-sm font-bold text-ink">
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
      <label className="grid text-sm font-bold text-ink">
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
      <button className="min-h-11 rounded-md bg-ink px-5 py-3 text-sm font-black text-paper hover:bg-charcoal" type="submit">
        Filtrar
      </button>
      <button className="min-h-11 rounded-md border border-gray px-5 py-3 text-sm font-black text-ink hover:bg-gray/20" onClick={clear} type="button">
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
