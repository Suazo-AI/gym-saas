"use client";

export default function AlertsError({ reset }: { reset: () => void }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
      <h1 className="text-xl font-black text-red-900">No pudimos abrir las alertas</h1>
      <p className="mt-2 text-sm text-red-800">Intenta cargar la pantalla nuevamente.</p>
      <button className="mt-4 min-h-11 rounded-lg bg-red-800 px-4 font-black text-white" onClick={reset} type="button">Reintentar</button>
    </section>
  );
}
