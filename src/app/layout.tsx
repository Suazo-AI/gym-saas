import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="es">
      <body className="min-h-screen bg-[#f6f9fc] font-sans text-slate-950 antialiased">
        {children}
      </body>
    </html>
  );
}
