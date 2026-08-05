export function PageSkeleton({ variant = "list" }: { variant?: "list" | "detail" | "dashboard" }) {
  const rows = variant === "dashboard" ? 4 : variant === "detail" ? 5 : 7;
  return (
    <div aria-label="Cargando" className="space-y-6" role="status">
      <div className="h-28 animate-pulse rounded-2xl border border-gray bg-paper shadow-sm" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: variant === "dashboard" ? 4 : 2 }).map((_, index) => <div className="h-24 animate-pulse rounded-xl border border-gray bg-paper" key={index} />)}
      </div>
      <section className="overflow-hidden rounded-xl border border-gray bg-paper shadow-sm">
        <div className="h-16 animate-pulse border-b border-gray bg-gray-light" />
        <div className="divide-y divide-gray">
          {Array.from({ length: rows }).map((_, index) => <div className="grid min-h-16 gap-3 p-4 md:grid-cols-3" key={index}><div className="h-4 animate-pulse rounded bg-gray-light" /><div className="h-4 animate-pulse rounded bg-gray-light" /><div className="h-4 animate-pulse rounded bg-gray-light" /></div>)}
        </div>
      </section>
      <span className="sr-only">Cargando contenido…</span>
    </div>
  );
}
