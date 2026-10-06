"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type FilterValues = {
  status: string;
  membershipStatus: string;
  hasOverdueCharges: string;
};

export function buildMemberFiltersHref(pathname: string, current: string, values: FilterValues) {
  const params = new URLSearchParams(current);
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  params.delete("page");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function MemberFilters() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    router.replace(buildMemberFiltersHref(pathname, searchParams.toString(), {
      status: String(form.get("status") ?? ""),
      membershipStatus: String(form.get("membershipStatus") ?? ""),
      hasOverdueCharges: String(form.get("hasOverdueCharges") ?? ""),
    }), { scroll: false });
  }

  function clearFilters() {
    router.replace(buildMemberFiltersHref(pathname, searchParams.toString(), {
      status: "",
      membershipStatus: "",
      hasOverdueCharges: "",
    }), { scroll: false });
  }

  return (
    <details className="px-5 pb-5 sm:[&::details-content]:[content-visibility:visible]" open={Boolean(searchParams.get("status") || searchParams.get("membershipStatus") || searchParams.get("hasOverdueCharges"))}>
      <summary className="btn btn-secondary w-fit cursor-pointer sm:hidden">Filtros</summary>
    <form className="mt-4 grid gap-4 sm:mt-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-end" onSubmit={submit}>
      <label className="field-label min-w-0">
        Estado del miembro
        <select className="field" defaultValue={searchParams.get("status") ?? ""} name="status">
          <option value="">Todos</option>
          <option value="prospect">Prospecto</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
          <option value="suspended">Suspendido</option>
          <option value="blocked">Bloqueado</option>
          <option value="archived">Archivado</option>
        </select>
      </label>
      <label className="field-label min-w-0">
        Estado de membresia
        <select className="field" defaultValue={searchParams.get("membershipStatus") ?? ""} name="membershipStatus">
          <option value="">Todos</option>
          <option value="trialing">En prueba</option>
          <option value="active">Activa</option>
          <option value="past_due">Con pago vencido</option>
          <option value="paused">Pausada</option>
        </select>
      </label>
      <label className="field-label min-w-0">
        Morosidad
        <select className="field" defaultValue={searchParams.get("hasOverdueCharges") ?? ""} name="hasOverdueCharges">
          <option value="">Todos</option>
          <option value="true">Con cargos vencidos</option>
          <option value="false">Sin cargos vencidos</option>
        </select>
      </label>
      <button className="btn btn-secondary self-end" type="submit">Aplicar</button>
      <button className="btn btn-quiet self-end" onClick={clearFilters} type="button">Limpiar</button>
    </form>
    </details>
  );
}
