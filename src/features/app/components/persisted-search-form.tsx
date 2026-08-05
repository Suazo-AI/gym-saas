"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function buildSearchHref(pathname: string, current: string, parameter: string, value: string) {
  const params = new URLSearchParams(current);
  if (value.trim()) params.set(parameter, value.trim());
  else params.delete(parameter);
  params.delete("page");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function PersistedSearchForm({
  storageKey,
  parameter = "search",
  placeholder = "Buscar",
}: {
  storageKey: string;
  parameter?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(() => searchParams.get(parameter) ?? "");
  const displayedValue = searchParams.get(parameter) ?? value;

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!searchParams.get(parameter) && saved) {
      router.replace(buildSearchHref(pathname, searchParams.toString(), parameter, saved), { scroll: false });
    }
  }, [parameter, pathname, router, searchParams, storageKey]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = value.trim();
    if (clean) window.localStorage.setItem(storageKey, clean);
    else window.localStorage.removeItem(storageKey);
    router.replace(buildSearchHref(pathname, searchParams.toString(), parameter, clean), { scroll: false });
  }

  return (
    <form className="flex flex-col gap-3 border-b border-gray p-4 sm:flex-row" onSubmit={submit}>
      <label className="sr-only" htmlFor={`${storageKey}-input`}>{placeholder}</label>
      <input className="min-h-11 flex-1 rounded-md border border-gray px-3 text-ink outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-sand" id={`${storageKey}-input`} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} value={displayedValue} />
      <button className="min-h-11 rounded-md bg-ink px-5 py-3 text-sm font-black text-paper hover:bg-charcoal" type="submit">Buscar</button>
    </form>
  );
}
