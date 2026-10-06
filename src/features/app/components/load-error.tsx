import type { ReactNode } from "react";

export function LoadError({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-[color-mix(in_srgb,var(--wait)_25%,transparent)] bg-wait-tint p-5 text-sm font-medium text-ink ${className}`}
      role="alert"
    >
      {children}
    </div>
  );
}
