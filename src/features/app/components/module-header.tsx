type ModuleHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function ModuleHeader({ eyebrow, title, description, action }: ModuleHeaderProps) {
  return (
    <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">{eyebrow}</p>
      <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-3xl font-black leading-tight text-ink sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-gray">{description}</p>
        </div>
        {action}
      </div>
    </header>
  );
}
