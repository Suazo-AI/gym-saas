import Image from "next/image";
import Link from "next/link";

const benefits = [
  {
    number: "01",
    title: "Membresias bajo control",
    copy: "Identifica miembros activos, vencimientos proximos y casos que necesitan seguimiento.",
  },
  {
    number: "02",
    title: "Cobros mas claros",
    copy: "Registra pagos en cordobas o dolares con reglas respaldadas por Supabase.",
  },
  {
    number: "03",
    title: "Recepcion rapida",
    copy: "Busca miembros y registra entradas sin depender de hojas, cuadernos o mensajes.",
  },
];

const activity = [
  ["JM", "Jose Martinez", "Entrada registrada", "8:42 AM"],
  ["AS", "Ana Salgado", "Membresia renovada", "8:18 AM"],
  ["CR", "Carlos Ruiz", "Nuevo miembro", "7:55 AM"],
];

export default function Home() {
  return (
    <main className="bg-white text-slate-950">
      <section className="min-h-[92vh] bg-[#083f88] px-5 py-5 text-white sm:px-8 lg:px-12">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-6" aria-label="Navegacion principal">
          <Link className="flex items-center gap-3 text-lg font-bold" href="/">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#ff7a1a]">F</span>
            Fit Manager
          </Link>
          <div className="hidden items-center gap-8 text-sm font-semibold md:flex">
            <a className="text-white/85 hover:text-white" href="#funciones">Funciones</a>
            <a className="text-white/85 hover:text-white" href="#como-funciona">Como funciona</a>
            <Link className="rounded-md bg-white px-4 py-2 text-[#083f88]" href="/login">Entrar</Link>
          </div>
        </nav>

        <div className="mx-auto grid max-w-7xl items-center gap-12 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-200">
              Gestion simple para gimnasios
            </p>
            <h1 className="mt-5 max-w-3xl text-5xl font-bold leading-[1.02] tracking-normal sm:text-6xl lg:text-7xl">
              Tu gimnasio, en orden.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-blue-50">
              Controla miembros, membresias, pagos y entradas desde un solo lugar. Menos trabajo manual y mas claridad para operar cada dia.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className="rounded-md bg-[#ff7a1a] px-5 py-3 text-center text-sm font-bold text-white hover:bg-[#e86305]" href="/login">
                Comenzar
              </Link>
              <a className="rounded-md border border-white/35 px-5 py-3 text-center text-sm font-bold text-white hover:bg-white/10" href="#funciones">
                Ver funciones
              </a>
            </div>
          </div>

          <div className="rounded-lg bg-white p-4 text-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <strong>Resumen de hoy</strong>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">En linea</span>
            </div>
            <div className="grid gap-3 py-4 sm:grid-cols-3">
              {[
                ["Miembros activos", "84"],
                ["Entradas hoy", "27"],
                ["Ingresos mes", "C$ 91,250"],
              ].map(([label, value]) => (
                <article className="rounded-md border border-slate-200 bg-[#f6f9fc] p-4" key={label}>
                  <span className="text-xs font-bold uppercase text-slate-500">{label}</span>
                  <strong className="mt-2 block text-2xl">{value}</strong>
                </article>
              ))}
            </div>
            <div className="space-y-3">
              {activity.map(([initials, name, event, time]) => (
                <div className="flex items-center gap-3 rounded-md border border-slate-200 p-3" key={name}>
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[#083f88] text-sm font-bold text-white">{initials}</span>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate">{name}</strong>
                    <small className="text-slate-500">{event}</small>
                  </div>
                  <time className="text-sm text-slate-500">{time}</time>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-12">
        <div className="relative min-h-[360px] overflow-hidden rounded-lg">
          <Image src="/images/gym-interior.png" alt="Interior de gimnasio independiente" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 55vw" />
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#ff7a1a]">Tu negocio, mas claro</p>
          <h2 className="mt-4 text-4xl font-bold leading-tight text-slate-950">Menos tiempo en hojas. Mas tiempo en el gimnasio.</h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Fit Manager reune la operacion diaria en un lugar simple. El dueno ve lo importante y recepcion sabe que hacer.
          </p>
        </div>
      </section>

      <section className="bg-[#f6f9fc] px-5 py-16 sm:px-8 lg:px-12" id="funciones">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#ff7a1a]">Lo esencial, bien hecho</p>
          <h2 className="mt-4 max-w-2xl text-4xl font-bold leading-tight">Todo lo que necesitas para iniciar el MVP.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {benefits.map((benefit) => (
              <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" key={benefit.number}>
                <span className="text-sm font-bold text-[#ff7a1a]">{benefit.number}</span>
                <h3 className="mt-4 text-xl font-bold">{benefit.title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{benefit.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 text-center sm:px-8 lg:px-12" id="como-funciona">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#ff7a1a]">Empieza simple</p>
        <h2 className="mx-auto mt-4 max-w-2xl text-4xl font-bold">Tu operacion clara desde el primer vistazo.</h2>
        <Link className="mt-8 inline-flex rounded-md bg-[#083f88] px-5 py-3 text-sm font-bold text-white hover:bg-[#062e64]" href="/login">
          Entrar al sistema
        </Link>
      </section>
    </main>
  );
}
