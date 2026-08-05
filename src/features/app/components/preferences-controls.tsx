"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

export type Locale = "es" | "en";
export type ThemePreference = "light" | "dark" | "system";
const eventName = "fitmanager-preferences";

export function PreferencesControls() {
  const locale = usePreference<Locale>("fitmanager-locale", "es");
  const theme = usePreference<ThemePreference>("fitmanager-theme", "system");
  const nextTheme:ThemePreference=theme==="system"?"light":theme==="light"?"dark":"system";
  const themeLabel=theme==="system"?(locale==="es"?"Sistema":"System"):theme==="light"?(locale==="es"?"Claro":"Light"):(locale==="es"?"Oscuro":"Dark");
  return <div className="mt-3 grid grid-cols-2 gap-2">
    <button aria-label="Cambiar idioma / Change language" className="min-h-10 rounded-md border border-white/20 px-3 text-xs font-black text-white hover:bg-white/10" onClick={()=>setPreference("fitmanager-locale",locale==="es"?"en":"es")} type="button">{locale==="es"?"ES":"EN"}</button>
    <button aria-label="Cambiar apariencia / Change appearance" className="min-h-10 rounded-md border border-white/20 px-3 text-xs font-black text-white hover:bg-white/10" onClick={()=>{setPreference("fitmanager-theme",nextTheme);applyTheme(nextTheme);}} type="button">{themeLabel}</button>
  </div>;
}

export function LocalizedNav({ screens, currentPath }: { screens: Array<{ code: string; name: string; route: string }>; currentPath: string }) {
  const locale = usePreference<Locale>("fitmanager-locale", "es");
  return <nav className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">{screens.map((screen) => <Link aria-current={currentPath === screen.route ? "page" : undefined} className={`rounded-md px-4 py-3 text-sm font-bold transition ${currentPath === screen.route ? "bg-brand-green text-white shadow-sm" : "text-gray-light hover:bg-white/10 hover:text-white"}`} href={screen.route} key={screen.route}>{screenLabel(screen.code, screen.name, locale)}</Link>)}</nav>;
}

function usePreference<T extends string>(key: string, fallback: T) { return useSyncExternalStore((notify) => { window.addEventListener(eventName, notify); window.addEventListener("storage", notify); return () => { window.removeEventListener(eventName, notify); window.removeEventListener("storage", notify); }; }, () => (localStorage.getItem(key) as T | null) ?? fallback, () => fallback); }
function setPreference(key:string,value:string){localStorage.setItem(key,value);if(key==="fitmanager-locale")document.documentElement.lang=value;window.dispatchEvent(new Event(eventName));}
function applyTheme(theme:ThemePreference){const resolved=theme==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):theme;document.documentElement.dataset.theme=resolved;document.documentElement.style.colorScheme=resolved;}
function screenLabel(code:string,fallback:string,locale:Locale){const labels:Record<string,[string,string]>={dashboard:["Resumen","Dashboard"],members:["Miembros","Members"],memberships:["Membresías","Memberships"],payments:["Pagos","Payments"],income:["Ingresos","Income"],facial_access:["Entradas","Entries"],staff:["Personal","Staff"],settings:["Configuración","Settings"]};return labels[code]?.[locale==="es"?0:1]??fallback;}
