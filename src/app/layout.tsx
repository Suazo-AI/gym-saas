import type { Metadata } from "next";
import { Suspense } from "react";
import "react-toastify/dist/ReactToastify.css";
import "./globals.css";

import { ToastProvider } from "@/features/app/components/toast-provider";
import { PreferencesInitializer } from "@/features/app/components/preferences-initializer";

export const metadata: Metadata = {
  title: "Fit Manager - Gestion simple para gimnasios",
  description: "Controla membresias, pagos y entradas desde un solo lugar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <PreferencesInitializer />
        {children}
        <Suspense>
          <ToastProvider />
        </Suspense>
      </body>
    </html>
  );
}
