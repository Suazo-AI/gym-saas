import Link from "next/link";

export default function MemberDetailNotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-gray-light p-6 text-ink">
      <section className="w-full max-w-lg rounded-lg border border-charcoal bg-paper p-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-red">Miembros</p>
        <h1 className="mt-2 text-2xl font-black">Miembro no encontrado</h1>
        <p className="mt-3 text-sm font-semibold text-gray-dark">
          El registro no existe o no está visible para el gimnasio activo.
        </p>
        <Link
          className="mt-5 inline-flex min-h-11 items-center rounded-md bg-ink px-5 py-3 text-sm font-black text-paper hover:bg-charcoal"
          href="/members"
        >
          Volver a miembros
        </Link>
      </section>
    </main>
  );
}
