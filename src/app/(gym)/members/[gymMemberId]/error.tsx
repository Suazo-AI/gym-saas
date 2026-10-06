"use client";

import { LoadError } from "@/features/app/components/load-error";

export default function MemberDetailError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-80 place-items-center p-4 text-ink sm:p-6">
      <LoadError className="w-full max-w-lg">
        <p className="type-eyebrow">Error</p>
        <h1 className="type-heading mt-2 text-2xl">No pudimos cargar el miembro</h1>
        <p className="mt-3 text-sm text-muted">
          Revisa tu sesión o intenta cargar nuevamente.
        </p>
        <button
          className="btn btn-primary mt-5"
          onClick={reset}
          type="button"
        >
          Intentar de nuevo
        </button>
      </LoadError>
    </main>
  );
}
