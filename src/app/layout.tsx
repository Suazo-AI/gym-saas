import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { Suspense } from "react";
import "react-toastify/dist/ReactToastify.css";
import "./globals.css";

import { ToastProvider } from "@/features/app/components/toast-provider";
import { PreferencesInitializer } from "@/features/app/components/preferences-initializer";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fit Manager - Gestion simple para gimnasios",
  description: "Controla membresias, pagos y entradas desde un solo lugar.",
};

// Resuelve el tema antes del primer pintado para que el modo oscuro no parpadee.
const themeScript = `try{var p=localStorage.getItem("fitmanager-theme")||"system";var t=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={archivo.variable} lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <PreferencesInitializer />
        {children}
        <Suspense>
          <ToastProvider />
        </Suspense>
      </body>
    </html>
  );
}
