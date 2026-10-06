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
    <form className="flex gap-2 border-b border-line p-4" onSubmit={submit} role="search">
      <label className="sr-only" htmlFor={`${storageKey}-input`}>{placeholder}</label>
      <div className="relative flex-1">
        <input autoComplete="off" className="field mt-0 pl-10" enterKeyHint="search" id={`${storageKey}-input`} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} type="search" value={displayedValue} />
        <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted" fill="none" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
      </div>
      <button className="btn btn-secondary shrink-0" type="submit">Buscar</button>
    </form>
  );
}
