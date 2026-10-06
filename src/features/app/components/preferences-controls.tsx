"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

export type Locale = "es" | "en";
export type ThemePreference = "light" | "dark" | "system";
const eventName = "fitmanager-preferences";

export function useLocale() {
  return usePreference<Locale>("fitmanager-locale", "es");
}

export function PreferencesControls() {
  const locale = usePreference<Locale>("fitmanager-locale", "es");
  const theme = usePreference<ThemePreference>("fitmanager-theme", "system");
  const nextTheme:ThemePreference=theme==="system"?"light":theme==="light"?"dark":"system";
  const themeLabel=theme==="system"?(locale==="es"?"Sistema":"System"):theme==="light"?(locale==="es"?"Claro":"Light"):(locale==="es"?"Oscuro":"Dark");
  return <div className="mt-3 grid grid-cols-2 gap-2">
    <button aria-label="Cambiar idioma / Change language" className="btn btn-secondary min-h-9 px-3 text-xs" onClick={()=>setPreference("fitmanager-locale",locale==="es"?"en":"es")} type="button">{locale==="es"?"ES":"EN"}</button>
    <button aria-label="Cambiar apariencia / Change appearance" className="btn btn-secondary min-h-9 px-3 text-xs" onClick={()=>{setPreference("fitmanager-theme",nextTheme);applyTheme(nextTheme);}} type="button">{themeLabel}</button>
  </div>;
}

// Agrupado por trabajo, no por tabla: lo de mostrador primero porque es lo que
// recepcion toca decenas de veces al dia.
const groups: Array<{ id: string; label: [string, string]; codes: string[] }> = [
  { id: "desk", label: ["Mostrador", "Front desk"], codes: ["entries", "members", "payments", "facial_access"] },
  { id: "business", label: ["Negocio", "Business"], codes: ["dashboard", "memberships", "income", "alerts"] },
  { id: "team", label: ["Equipo", "Team"], codes: ["staff", "settings"] },
];

export function LocalizedNav({ screens, currentPath }: { screens: Array<{ code: string; name: string; route: string }>; currentPath?: string }) {
  const locale = usePreference<Locale>("fitmanager-locale", "es");
  const pathname = usePathname();
  const activePath = pathname || currentPath;
  const known = new Set(groups.flatMap((group) => group.codes));
  const sections = [
    ...groups.map((group) => ({ id: group.id, label: group.label[locale === "es" ? 0 : 1], items: group.codes.map((code) => screens.find((screen) => screen.code === code)).filter((screen) => screen !== undefined) })),
    { id: "other", label: locale === "es" ? "Más" : "More", items: screens.filter((screen) => !known.has(screen.code)) },
  ].filter((section) => section.items.length > 0);
  return <nav aria-label="Principal" className="mt-5 grid gap-5">{sections.map((section) => <div key={section.id}>
    <p className="px-2 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">{section.label}</p>
    <ul className="grid gap-0.5">{section.items.map((screen) => {
      const active = activePath === screen.route || (screen.route !== "/dashboard" && activePath?.startsWith(`${screen.route}/`));
      return <li key={screen.route}><Link aria-current={active ? "page" : undefined} className={`flex min-h-10 items-center gap-3 rounded-[10px] px-2 text-[0.9375rem] font-medium transition-colors duration-150 active:bg-fill-strong ${active ? "bg-accent-tint text-ink" : "text-ink-2 hover:bg-fill"}`} href={screen.route}>
        <NavIcon active={Boolean(active)} code={screen.code} />
        {screenLabel(screen.code, screen.name, locale)}
      </Link></li>;
    })}</ul>
  </div>)}</nav>;
}

function NavIcon({ code, active }: { code: string; active: boolean }) {
  const paths: Record<string, string> = {
    entries: "M4 20V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v15M15 12h5m-2-2 2 2-2 2M10 12h.01",
    members: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 19v-1a4 4 0 0 0-3-3.87M15.5 4.13a3 3 0 0 1 0 5.74",
    payments: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h3",
    facial_access: "M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0",
    dashboard: "M4 13h6V4H4zM14 20h6v-9h-6zM14 4v3h6V4zM4 20h6v-3H4z",
    memberships: "M4 7h16v10H4zM8 7V5h8v2M4 12h16",
    income: "M4 19h16M7 15l3-4 3 2 4-6",
    alerts: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0",
    staff: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1",
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1",
  };
  return <svg aria-hidden="true" className={`size-[18px] shrink-0 ${active ? "text-accent" : "text-muted"}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d={paths[code] ?? "M5 12h14"} /></svg>;
}

function usePreference<T extends string>(key: string, fallback: T) { return useSyncExternalStore((notify) => { window.addEventListener(eventName, notify); window.addEventListener("storage", notify); return () => { window.removeEventListener(eventName, notify); window.removeEventListener("storage", notify); }; }, () => (localStorage.getItem(key) as T | null) ?? fallback, () => fallback); }

function setPreference(key:string,value:string){localStorage.setItem(key,value);if(key==="fitmanager-locale")document.documentElement.lang=value;window.dispatchEvent(new Event(eventName));}

function applyTheme(theme:ThemePreference){const resolved=theme==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):theme;document.documentElement.dataset.theme=resolved;document.documentElement.style.colorScheme=resolved;}

function screenLabel(code:string,fallback:string,locale:Locale){const labels:Record<string,[string,string]>={dashboard:["Resumen","Dashboard"],members:["Miembros","Members"],memberships:["Membresías","Memberships"],payments:["Pagos","Payments"],income:["Ingresos","Income"],entries:["Recepción","Front desk"],facial_access:["Acceso facial","Facial access"],alerts:["Alertas","Alerts"],staff:["Personal","Staff"],settings:["Configuración","Settings"]};return labels[code]?.[locale==="es"?0:1]??fallback;}
