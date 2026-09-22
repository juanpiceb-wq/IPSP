"use client";

import { RULES } from "@/lib/rules";
import type { MenuMetrics } from "@/lib/types";

export default function MetricsBar({ metrics }: { metrics: MenuMetrics | null }) {
  const cells = [
    {
      value: metrics ? `${metrics.mainCount}` : "—",
      label: "Platos fuertes",
      hint: `de ${RULES.MAIN_SLOTS}`,
      tone: metrics && metrics.mainCount === RULES.MAIN_SLOTS ? "ok" : "warn",
    },
    {
      value: metrics ? `${metrics.saladCount} / ${metrics.saladTarget}` : "—",
      label: "Con ensalada",
      hint: `mínimo ${RULES.SALAD_MIN}`,
      tone: metrics && metrics.saladCount >= RULES.SALAD_MIN ? "ok" : "error",
    },
    {
      value: metrics ? `${metrics.errors}` : "—",
      label: "Errores críticos",
      hint: "reglas duras",
      tone: metrics && metrics.errors === 0 ? "ok" : "error",
    },
    {
      value: metrics ? `${metrics.warnings}` : "—",
      label: "Advertencias",
      hint: "preferencias",
      tone: metrics && metrics.warnings === 0 ? "ok" : "warn",
    },
    {
      value: metrics ? `${metrics.varietyScore}%` : "—",
      label: "Variedad",
      hint: `últimas ${RULES.HISTORY_WEEKS} semanas`,
      tone: metrics && metrics.varietyScore >= 80 ? "ok" : "warn",
    },
    {
      value: metrics ? `${metrics.maxDailyDifficulty ?? 0} / ${RULES.MAX_DAILY_DIFFICULTY}` : "—",
      label: "Carga máxima",
      hint: "dificultad diaria",
      tone: metrics && (metrics.maxDailyDifficulty ?? 0) <= RULES.MAX_DAILY_DIFFICULTY ? "ok" : "error",
    },
    {
      value: metrics ? `${metrics.inventoryUsePct ?? 0}%` : "—",
      label: "Stock controlado",
      hint: "uso medio de insumos cuantificables",
      tone: metrics && (metrics.inventoryUsePct ?? 0) <= 100 ? "ok" : "error",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      {cells.map((c) => (
        <div key={c.label} className="card px-4 py-3">
          <div
            className={`text-2xl font-bold ${
              c.tone === "ok" ? "text-corp-600" : c.tone === "warn" ? "text-amber-600" : "text-red-600"
            }`}
          >
            {c.value}
          </div>
          <div className="text-[12px] font-semibold text-navy-800">{c.label}</div>
          <div className="text-[11px] text-muted">{c.hint}</div>
        </div>
      ))}
    </div>
  );
}
