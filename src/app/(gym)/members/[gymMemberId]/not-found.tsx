import Link from "next/link";

export default function MemberDetailNotFound() {
  return (
    <main className="grid min-h-80 place-items-center p-4 text-ink sm:p-6">
      <section className="panel w-full max-w-lg p-6">
        <p className="type-eyebrow">Miembros</p>
        <h1 className="type-heading mt-2 text-2xl">Miembro no encontrado</h1>
        <p className="mt-3 text-sm text-muted">
          El registro no existe o no está visible para el gimnasio activo.
        </p>
        <Link
          className="btn btn-primary mt-5"
          href="/members"
        >
          Volver a miembros
        </Link>
      </section>
    </main>
  );
}
