import Link from "next/link";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main className="grid min-h-screen bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="flex min-h-screen flex-col justify-center px-5 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link className="flex items-center gap-3 font-display text-base font-bold text-ink" href="/">
            <span className="grid size-9 place-items-center rounded-[10px] bg-accent font-extrabold text-accent-ink">
              F
            </span>
            Fit Manager
          </Link>
          <p className="type-eyebrow mt-10">Acceso del equipo</p>
          <h1 className="type-title mt-1.5 text-ink">{title}</h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{subtitle}</p>
          <div className="panel mt-8 p-6">
            {children}
          </div>
        </div>
      </section>
      <aside
        className="hidden min-h-screen flex-col justify-between bg-[var(--flood-ok)] p-12 text-white lg:flex"
        aria-label="Resumen del producto"
      >
        <p className="text-sm font-semibold opacity-85">Software para gimnasios pequenos</p>
        <div>
          <p aria-hidden="true" className="verdict-word text-[clamp(3rem,6vw,5.5rem)]">Puede<br />entrar</p>
          <h2 className="mt-6 max-w-md text-xl font-medium leading-snug opacity-95">
            Controla miembros, pagos y entradas desde una operacion clara.
          </h2>
        </div>
      </aside>
    </main>
  );
}
