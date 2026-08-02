type ModuleHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function ModuleHeader({ eyebrow, title, description, action }: ModuleHeaderProps) {
  return (
    <header className="rounded-lg border border-charcoal border-t-4 border-t-brand-orange bg-ink p-6 text-paper sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-sand">{eyebrow}</p>
      <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-gray-light">{description}</p>
        </div>
        {action}
      </div>
    </header>
  );
}
