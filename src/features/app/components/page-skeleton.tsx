type Screen = "dashboard" | "income" | "members" | "entries" | "alerts" | "payments" | "memberships" | "settings" | "staff" | "detail" | "platform";

const pulse = "animate-pulse rounded-md bg-fill-strong";
const card = "panel";

function HeaderSkeleton() {
  return <header className="pb-2"><div className={`${pulse} h-3 w-24`} /><div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div className="space-y-3"><div className={`${pulse} h-9 w-72 max-w-full`} /><div className={`${pulse} h-4 w-[28rem] max-w-full`} /></div><div className={`${pulse} h-11 w-40`} /></div></header>;
}

function Rows({ count = 6, columns = 3 }: { count?: number; columns?: number }) {
  const grid = columns === 1 ? "md:grid-cols-1" : columns === 2 ? "md:grid-cols-2" : columns === 4 ? "md:grid-cols-4" : "md:grid-cols-3";
  return <div className="divide-y divide-line">{Array.from({ length: count }).map((_, index) => <div className={`grid min-h-16 gap-3 p-4 ${grid}`} key={index}>{Array.from({ length: columns }).map((__, column) => <div className={`${pulse} h-4 ${column === 0 ? "w-3/4" : "w-1/2"}`} key={column} />)}</div>)}</div>;
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <section className={`${card} overflow-hidden ${className}`}>{children}</section>; }
function PanelTitle() { return <div className="border-b border-line p-5"><div className={`${pulse} h-6 w-48`} /><div className={`${pulse} mt-3 h-4 w-72 max-w-full`} /></div>; }

export function PageSkeleton({ screen = "members" }: { screen?: Screen }) {
  let content: React.ReactNode;
  if (screen === "dashboard" || screen === "platform") {
    content = <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div className={`${card} h-28 p-5`} key={index}><div className={`${pulse} h-3 w-24`} /><div className={`${pulse} mt-4 h-8 w-28`} /></div>)}</div><div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"><Panel><PanelTitle /><div className="h-64 animate-pulse bg-fill" /></Panel><Panel><PanelTitle /><Rows count={4} columns={2} /></Panel></div></>;
  } else if (screen === "income") {
    content = <Panel><PanelTitle /><Rows count={7} columns={2} /></Panel>;
  } else if (screen === "memberships" || screen === "settings") {
    content = <div className="grid gap-6 xl:grid-cols-[380px_1fr]"><Panel><PanelTitle /><div className="space-y-4 p-5">{Array.from({ length: 5 }).map((_, index) => <div className={`${pulse} h-11`} key={index} />)}</div></Panel><Panel><PanelTitle /><Rows count={5} columns={3} /></Panel></div>;
  } else if (screen === "staff") {
    content = <><Panel><PanelTitle /><Rows count={6} columns={4} /></Panel><Panel><PanelTitle /><Rows count={4} columns={3} /></Panel></>;
  } else if (screen === "entries") {
    content = <><Panel><PanelTitle /><div className="h-16 animate-pulse border-b border-gray bg-fill" /><Rows count={4} columns={2} /></Panel><Panel><PanelTitle /><Rows count={6} columns={3} /></Panel></>;
  } else if (screen === "payments") {
    content = <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]"><Panel><PanelTitle /><div className="space-y-4 p-5">{Array.from({ length: 4 }).map((_, index) => <div className={`${pulse} h-11`} key={index} />)}</div></Panel><Panel><PanelTitle /><Rows count={6} columns={4} /></Panel></div>;
  } else {
    content = <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]"><Panel><PanelTitle /><Rows count={7} columns={2} /></Panel><Panel><PanelTitle /><Rows count={5} columns={1} /></Panel></div>;
  }

  return <div aria-label="Cargando" className="space-y-6" role="status"><HeaderSkeleton />{content}<span className="sr-only">Cargando contenido…</span></div>;
}
