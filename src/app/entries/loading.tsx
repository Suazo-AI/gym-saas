export default function EntriesLoading() {
  return (
    <main className="mx-auto max-w-6xl p-6" aria-busy="true">
      <div className="h-10 w-64 animate-pulse rounded-md bg-gray-light" />
      <div className="mt-6 h-48 animate-pulse rounded-lg border border-charcoal bg-paper shadow-sm" />
      <p className="mt-4 text-sm font-semibold text-charcoal">Cargando entradas...</p>
    </main>
  );
}
