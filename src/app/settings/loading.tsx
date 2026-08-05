export default function SettingsLoading() {
  return <main aria-busy="true" aria-live="polite" className="min-h-screen bg-slate-50 p-6">
    <span className="sr-only">Cargando configuración de sucursales</span>
    <div aria-hidden="true" className="mx-auto max-w-6xl animate-pulse space-y-6">
      <div className="h-20 rounded-2xl bg-slate-200" />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]"><div className="h-96 rounded-2xl bg-slate-200" /><div className="h-96 rounded-2xl bg-slate-200" /></div>
    </div>
  </main>;
}
