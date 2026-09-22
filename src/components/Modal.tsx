"use client";

import { useEffect } from "react";

export default function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-900/45 p-4 py-10">
      <div className={`card w-full ${wide ? "max-w-4xl" : "max-w-2xl"} p-0`}>
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-navy-800">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p> : null}
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm" type="button">
            Cerrar
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
