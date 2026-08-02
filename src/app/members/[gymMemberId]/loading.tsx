export default function MemberDetailLoading() {
  return (
    <main className="min-h-screen bg-gray-light p-6 text-ink" role="status">
      <div className="mx-auto max-w-6xl animate-pulse">
        <span className="sr-only">Cargando detalle del miembro</span>
        <div className="h-5 w-32 rounded bg-gray" />
        <div className="mt-4 h-10 max-w-lg rounded bg-gray" />
        <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="h-72 rounded-lg bg-gray" />
          <div className="h-52 rounded-lg bg-gray" />
        </div>
      </div>
    </main>
  );
}
