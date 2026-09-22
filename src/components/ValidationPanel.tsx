"use client";

import type { MenuMetrics, ValidationIssue } from "@/lib/types";

const STYLE: Record<string, { dot: string; text: string; icon: string }> = {
  ok: { dot: "bg-emerald-500", text: "text-emerald-800", icon: "✓" },
  warn: { dot: "bg-amber-500", text: "text-amber-800", icon: "!" },
  error: { dot: "bg-red-600", text: "text-red-800", icon: "✕" },
};

export default function ValidationPanel({
  issues,
  metrics,
  capacityWarning,
}: {
  issues: ValidationIssue[];
  metrics: MenuMetrics | null;
  capacityWarning?: string | null;
}) {
  const sorted = [...issues].sort((a, b) => rank(a.level) - rank(b.level));
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-navy-800">Validación</h3>
        {metrics ? (
          <span
            className={`badge ${
              metrics.errors > 0
                ? "bg-red-100 text-red-700"
                : metrics.warnings > 0
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {metrics.errors > 0
              ? `${metrics.errors} error${metrics.errors > 1 ? "es" : ""}`
              : metrics.warnings > 0
              ? `${metrics.warnings} advertencia${metrics.warnings > 1 ? "s" : ""}`
              : "Sin observaciones"}
          </span>
        ) : null}
      </div>

      {capacityWarning ? (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-900">
          {capacityWarning}
        </div>
      ) : null}

      <ul className="mt-3 space-y-2">
        {sorted.map((i, idx) => {
          const st = STYLE[i.level];
          return (
            <li key={idx} className="flex gap-2 text-[12.5px] leading-snug">
              <span
                className={`mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${st.dot} text-[10px] font-bold text-white`}
              >
                {st.icon}
              </span>
              <span className={st.text}>{i.message}</span>
            </li>
          );
        })}
        {sorted.length === 0 ? (
          <li className="text-[12.5px] text-muted">Genere un menú para ver la validación.</li>
        ) : null}
      </ul>
    </div>
  );
}

function rank(level: string) {
  return level === "error" ? 0 : level === "warn" ? 1 : 2;
}
