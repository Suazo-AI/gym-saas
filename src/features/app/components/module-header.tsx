type ModuleHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
};

// Encabezado sobre el lienzo, sin caja: el titulo dice donde estas y la accion
// principal queda a la derecha, alineada con la ultima linea de texto.
export function ModuleHeader({ eyebrow, title, description, action }: ModuleHeaderProps) {
  return (
    <header className="flex flex-col justify-between gap-4 pb-2 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <p className="type-eyebrow">{eyebrow}</p>
        <h1 className="type-title mt-1.5 text-ink">{title}</h1>
        <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">{description}</p>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </header>
  );
}
