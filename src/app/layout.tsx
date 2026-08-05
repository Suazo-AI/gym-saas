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
    <html lang="es" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:`(()=>{try{const t=localStorage.getItem('fitmanager-theme')||'system';const d=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d;document.documentElement.lang=localStorage.getItem('fitmanager-locale')||'es'}catch{}})();`}} /></head>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
