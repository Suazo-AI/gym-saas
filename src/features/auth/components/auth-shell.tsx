import Link from "next/link";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main className="grid min-h-screen bg-[#f6f9fc] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <section className="flex min-h-screen flex-col justify-center px-6 py-10 sm:px-10 lg:px-16">
        <Link className="mb-10 flex items-center gap-3 text-lg font-bold text-[#083f88]" href="/">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-[#083f88] text-white">
            F
          </span>
          Fit Manager
        </Link>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff7a1a]">
            Acceso del equipo
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-normal text-slate-950">{title}</h1>
          <p className="mt-3 max-w-md text-base leading-7 text-slate-600">{subtitle}</p>
        </div>
        <div className="mt-8 max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          {children}
        </div>
      </section>
      <aside
        className="hidden min-h-screen items-end bg-[#083f88] p-12 text-white lg:flex"
        aria-label="Resumen del producto"
      >
        <div className="max-w-xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-200">
            Software para gimnasios pequenos
          </p>
          <h2 className="mt-4 text-5xl font-bold leading-tight">
            Controla miembros, pagos y entradas desde una operacion clara.
          </h2>
        </div>
      </aside>
    </main>
  );
}
