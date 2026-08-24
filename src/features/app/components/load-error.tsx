import type { ReactNode } from "react";

export function LoadError({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg bg-amber-50 p-5 text-sm font-semibold text-amber-900 ${className}`}
      role="alert"
    >
      {children}
    </div>
  );
}
