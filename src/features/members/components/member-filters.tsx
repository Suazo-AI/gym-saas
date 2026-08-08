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
    <form className="grid gap-3 border-b border-gray p-4 md:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end" onSubmit={submit}>
      <label className="text-sm font-bold text-ink">
        Estado del miembro
        <select className="mt-2 min-h-11 w-full rounded-md border border-gray bg-paper px-3" defaultValue={searchParams.get("status") ?? ""} name="status">
          <option value="">Todos</option>
          <option value="prospect">Prospecto</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
          <option value="suspended">Suspendido</option>
          <option value="blocked">Bloqueado</option>
          <option value="archived">Archivado</option>
        </select>
      </label>
      <label className="text-sm font-bold text-ink">
        Estado de membresia
        <select className="mt-2 min-h-11 w-full rounded-md border border-gray bg-paper px-3" defaultValue={searchParams.get("membershipStatus") ?? ""} name="membershipStatus">
          <option value="">Todos</option>
          <option value="trialing">En prueba</option>
          <option value="active">Activa</option>
          <option value="past_due">Con pago vencido</option>
          <option value="paused">Pausada</option>
        </select>
      </label>
      <label className="text-sm font-bold text-ink">
        Morosidad
        <select className="mt-2 min-h-11 w-full rounded-md border border-gray bg-paper px-3" defaultValue={searchParams.get("hasOverdueCharges") ?? ""} name="hasOverdueCharges">
          <option value="">Todos</option>
          <option value="true">Con cargos vencidos</option>
          <option value="false">Sin cargos vencidos</option>
        </select>
      </label>
      <button className="min-h-11 rounded-md bg-ink px-5 py-3 text-sm font-black text-paper hover:bg-charcoal" type="submit">Aplicar</button>
      <button className="min-h-11 rounded-md border border-charcoal px-5 py-3 text-sm font-black text-ink hover:bg-gray-light" onClick={clearFilters} type="button">Limpiar</button>
    </form>
  );
}
