import Link from "next/link";

const nav = ["Resumen", "Miembros", "Membresias", "Pagos", "Entradas", "Reportes"];
const members = [
  { initials: "AM", name: "Ana Martinez", plan: "Mensual", status: "Activo", date: "14 ago 2026" },
  { initials: "JR", name: "Jorge Ramirez", plan: "Mensual", status: "Por vencer", date: "16 jul 2026" },
  { initials: "LC", name: "Lucia Castillo", plan: "Trimestral", status: "Activo", date: "02 oct 2026" },
  { initials: "DS", name: "Diego Sanchez", plan: "Mensual", status: "Vencido", date: "10 jul 2026" },
];

export default function AdminPage() {
  return (
    <main className="grid min-h-screen bg-[#f6f9fc] text-slate-950 lg:grid-cols-[280px_1fr]">
      <aside className="border-r border-slate-200 bg-white p-5">
        <Link className="flex items-center gap-3 text-lg font-bold text-[#083f88]" href="/">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-[#083f88] text-white">F</span>
          Fit Manager
        </Link>
        <div className="mt-8 rounded-lg bg-[#f6f9fc] p-4">
          <small className="font-bold uppercase text-slate-500">Gimnasio actual</small>
          <strong className="mt-1 block">Impulso Fitness</strong>
          <span className="text-sm text-slate-500">Managua, Nicaragua</span>
        </div>
        <nav className="mt-8 space-y-1">
          {nav.map((item, index) => (
            <a
              className={`block rounded-md px-3 py-3 text-sm font-semibold ${
                index === 0 ? "bg-[#083f88] text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
              href="#"
              key={item}
            >
              {item}
            </a>
          ))}
        </nav>
      </aside>
      <section className="p-5 sm:p-8">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <small className="font-bold uppercase tracking-[0.18em] text-[#ff7a1a]">Demo visual</small>
            <h1 className="mt-2 text-3xl font-bold">Buenos dias, Jason.</h1>
            <p className="mt-1 text-slate-600">Datos ficticios para validar estructura visual.</p>
          </div>
          <button className="rounded-md bg-[#ff7a1a] px-4 py-3 text-sm font-bold text-white">Nuevo miembro</button>
        </header>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Miembros activos", "84", "6 mas este mes"],
            ["Entradas hoy", "27", "32% de activos"],
            ["Ingresos del mes", "C$ 91,250", "8.4% vs mes pasado"],
            ["Por vencer", "9", "Proximos 7 dias"],
          ].map(([label, value, note]) => (
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" key={label}>
              <span className="text-xs font-bold uppercase text-slate-500">{label}</span>
              <strong className="mt-2 block text-3xl">{value}</strong>
              <small className="mt-2 block text-slate-500">{note}</small>
            </article>
          ))}
        </div>
        <article className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <small className="font-bold uppercase text-[#ff7a1a]">Miembros</small>
            <h2 className="mt-1 text-xl font-bold">Actividad reciente</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {members.map((member) => (
              <div className="grid gap-3 p-4 sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:items-center" key={member.name}>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[#083f88] text-sm font-bold text-white">{member.initials}</span>
                  <strong>{member.name}</strong>
                </div>
                <span className="text-slate-600">{member.plan}</span>
                <span className="text-slate-600">{member.status}</span>
                <span className="text-slate-600">{member.date}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
