"use client";

export default function MemberDetailError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-gray-light p-6 text-ink">
      <section className="w-full max-w-lg rounded-lg border border-brand-red bg-paper p-6" role="alert">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-red">Error</p>
        <h1 className="mt-2 text-2xl font-black">No pudimos cargar el miembro</h1>
        <p className="mt-3 text-sm font-semibold text-gray-dark">
          Revisa tu sesión o intenta cargar nuevamente.
        </p>
        <button
          className="mt-5 min-h-11 rounded-md bg-ink px-5 py-3 text-sm font-black text-paper hover:bg-charcoal"
          onClick={reset}
          type="button"
        >
          Intentar de nuevo
        </button>
      </section>
    </main>
  );
}
