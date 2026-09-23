import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

import { getRepo } from "@/lib/db";

export const metadata: Metadata = {
  title: "Proyecto de Mejora de Alimentación IPSP",
  description: "Sistema de control para la mejora de alimentación IPSP",
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

      </body>
    </html>
  );
}



