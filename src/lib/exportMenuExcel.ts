"use client";

import { WEEKDAYS } from "./types";
import type { Catalog, MainService, MenuItem, Weekday } from "./types";

interface ExportArgs {
  items: MenuItem[];
  catalog: Catalog;
  year: number;
  week: number;
  campName: string;
  diners?: number;
  start?: string | null;
  end?: string | null;
}

export function exportMenuExcel(args: ExportArgs) {
  const recipeName = (id: string | null | undefined) => id ? args.catalog.recipes.find((r) => r.id === id)?.name ?? "" : "";
  const proteinName = (id: string | null | undefined) => id ? args.catalog.proteins.find((p) => p.id === id)?.name ?? "" : "";
  const find = (w: Weekday, s: MainService, component: "main" | "soup") =>
    args.items.find((i) => i.weekday === w && i.service === s && i.component === component);

  const rows: string[][] = [];
  rows.push([`MENÚ SEMANAL · SEMANA ${args.week} · ${args.year}`]);
  rows.push([args.campName, args.diners ? `${args.diners} comensales` : "", args.start && args.end ? `${args.start} → ${args.end}` : ""]);
  rows.push([]);
  rows.push(["SERVICIO", "COMPONENTE", ...WEEKDAYS.map((d) => d.label)]);
  rows.push(["DESAYUNO", "Plato fuerte", ...WEEKDAYS.map((d) => recipeName(find(d.value, "breakfast", "main")?.recipe_id))]);
  rows.push(["", "Proteína", ...WEEKDAYS.map((d) => proteinName(find(d.value, "breakfast", "main")?.protein_id))]);
  rows.push(["", "Arroz", ...WEEKDAYS.map(() => "Incluido")]);
  rows.push(["", "Bebida", ...WEEKDAYS.map((d) => find(d.value, "breakfast", "main")?.beverage ?? "")]);
  rows.push(["ALMUERZO", "Sopa", ...WEEKDAYS.map((d) => d.value === 6 ? "No aplica" : recipeName(find(d.value, "lunch", "soup")?.recipe_id))]);
  rows.push(["", "Plato fuerte", ...WEEKDAYS.map((d) => recipeName(find(d.value, "lunch", "main")?.recipe_id))]);
  rows.push(["", "Proteína", ...WEEKDAYS.map((d) => proteinName(find(d.value, "lunch", "main")?.protein_id))]);
  rows.push(["", "Arroz", ...WEEKDAYS.map(() => "Incluido")]);
  rows.push(["", "Ensalada", ...WEEKDAYS.map(() => "Ensalada a elección")]);
  rows.push(["", "Bebida", ...WEEKDAYS.map((d) => find(d.value, "lunch", "main")?.beverage ?? "")]);
  rows.push(["CENA", "Plato fuerte", ...WEEKDAYS.map((d) => recipeName(find(d.value, "dinner", "main")?.recipe_id))]);
  rows.push(["", "Proteína", ...WEEKDAYS.map((d) => proteinName(find(d.value, "dinner", "main")?.protein_id))]);
  rows.push(["", "Arroz", ...WEEKDAYS.map(() => "Incluido")]);
  rows.push(["", "Ensalada", ...WEEKDAYS.map((d) => recipeName(find(d.value, "dinner", "main")?.salad_recipe_id) || "Sin ensalada")]);
  rows.push(["", "Bebida", ...WEEKDAYS.map((d) => find(d.value, "dinner", "main")?.beverage ?? "")]);
  rows.push([]);

  const htmlRows = rows.map((row, ri) => {
    const cells = row.map((cell) => {
      const tag = ri === 3 ? "th" : "td";
      return `<${tag}>${escapeHtml(cell ?? "")}</${tag}>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif} table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #a9b8b3;padding:6px;vertical-align:top;font-size:11px}
    th{background:#0b5d4a;color:#fff;font-weight:bold} tr:first-child td{font-size:16px;font-weight:bold;background:#123e35;color:#fff}
  </style></head><body><table>${htmlRows}</table></body></html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `menu_semana_${args.week}_${safeFile(args.campName)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function safeFile(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").toLowerCase();
}


