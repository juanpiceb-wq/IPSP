import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Watermark from "@/components/Watermark";
import { getRepo } from "@/lib/db";

export const metadata: Metadata = {
  title: "Planificación de Alimentación",
  description: "Generación, validación y control de menús semanales de campamentos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const mode = getRepo().mode;
  return (
    <html lang="es">
      <body className="min-h-screen font-sans antialiased">
        <div className="flex min-h-screen">
          <Sidebar mode={mode} />
          <main className="flex-1 overflow-x-hidden">{children}</main>
        </div>
        <Watermark />
      </body>
    </html>
  );
}
