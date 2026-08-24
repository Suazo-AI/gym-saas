"use client";

import { useEffect } from "react";

export function PreferencesInitializer() {
  useEffect(() => {
    const preference = localStorage.getItem("fitmanager-theme") ?? "system";
    const theme = preference === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      : preference;

    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.documentElement.lang = localStorage.getItem("fitmanager-locale") ?? "es";
  }, []);

  return null;
}
