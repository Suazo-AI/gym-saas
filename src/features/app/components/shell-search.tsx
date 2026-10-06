"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Busqueda de miembros siempre a mano: la recepcion empieza casi todo por aqui.
// En /entries la pagina ya tiene su propio buscador, asi que se oculta.
export function ShellSearch({ canCreateMembers, className }: { canCreateMembers: boolean; className: string }) {
  const pathname = usePathname();
  if (pathname === "/entries") return null;
  return (
    <div className={className}>
      <form action="/entries" className="relative min-w-0 flex-1 lg:max-w-xl" role="search">
        <label className="sr-only" htmlFor="shell-member-search">Buscar miembro</label>
        <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted" fill="none" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
        <input
          autoComplete="off"
          className="field mt-0 bg-surface pl-10"
          enterKeyHint="search"
          id="shell-member-search"
          name="search"
          placeholder="Buscar miembro por nombre, teléfono o código"
          type="search"
        />
      </form>
      {canCreateMembers ? (
        <Link className="btn btn-primary shrink-0" href="/members/new">
          <span aria-hidden="true" className="text-lg leading-none">+</span>
          <span className="hidden sm:inline">Nuevo miembro</span>
          <span className="sr-only sm:hidden">Nuevo miembro</span>
        </Link>
      ) : null}
    </div>
  );
}
