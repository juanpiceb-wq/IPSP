"use client";

import { buildCalendarWeek } from "./calendarWeek";
import type { CalendarDay, WeekMenuSource } from "./calendarWeek";
import type { Catalog, MainService, MenuItem } from "./types";

/**
 * Exportación al formato FORMATO_MENU_PILOTO (hoja "COMEDOR"):
 * ZONA | SEMANA | FECHA | DÍA | DESAYUNO | ALMUERZO 1° PLATO | ALMUERZO 2° PLATO | MERIENDA
 * Una fila por día de lunes a domingo y un bloque de 7 filas por zona.
 * Varias zonas o semanas salen en el mismo archivo, una debajo de otra.
 */
export interface ComedorBlock {
  zoneName: string;
  current: WeekMenuSource;
  previous: WeekMenuSource | null;
}

const DAY_NAMES = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"];
const HEADERS = ["ZONA", "SEMANA", "FECHA\n*dd/mm/aaaa", "DÍA", "DESAYUNO", "ALMUERZO 1° PLATO", "ALMUERZO 2° PLATO", "MERIENDA"];
const WIDTHS = [15.1, 11.55, 14.44, 12, 29, 28.1, 32.33, 41];

/** Texto de cada celda: mayúsculas, con arroz (salvo arroz integrado) y la ensalada del servicio. */
export function comedorCellText(day: CalendarDay, service: MainService, component: "main" | "soup", catalog: Catalog): string {
  if (day.source === "none") return "";
  if (component === "soup" && day.weekday === 6) return "-";
  const item = day.items.find((i) => i.service === service && i.component === component);
  const recipe = item?.recipe_id ? catalog.recipes.find((r) => r.id === item.recipe_id) : null;
  if (!item || !recipe) return "-";
  const name = upper(recipe.name);
  if (component === "soup") return name;
  const integrated = recipe.rice_mode === "integrated" || name.startsWith("ARROZ");
  const withRice = integrated ? name : service === "breakfast" ? `ARROZ Y ${name}` : `ARROZ CON ${name}`;
  return service === "breakfast" ? withRice : `${withRice}${saladSuffix(item, catalog)}`;
}

function saladSuffix(item: MenuItem, catalog: Catalog): string {
  if (!item.salad_recipe_id) return "";
  const salad = catalog.recipes.find((r) => r.id === item.salad_recipe_id);
  if (!salad) return "";
  const s = upper(salad.name);
  if (s.startsWith("ENSALADA SEGÚN STOCK") || s.startsWith("ENSALADA SEGUN STOCK")) return " Y ENSALADA";
  return ` CON ${s}`;
}

function upper(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function excelDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export async function buildComedorWorkbook(blocks: ComedorBlock[], catalog: Catalog): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Proyecto de Mejora de Alimentación IPSP";
  const ws = wb.addWorksheet("COMEDOR", {
    views: [{ state: "frozen", ySplit: 2, zoomScale: 90 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  ws.columns = WIDTHS.map((width) => ({ width }));

  const black = { argb: "FF000000" };
  const thin = { style: "thin" as const, color: black };
  const medium = { style: "medium" as const, color: black };
  const box = { top: thin, left: thin, bottom: thin, right: thin };

  // Fila 1: franja superior fina (igual que la plantilla).
  ws.getRow(1).height = 5.25;
  ws.mergeCells("A1:H1");
  ws.getCell("A1").border = { top: medium, left: medium, right: medium };

  // Fila 2: encabezados.
  const header = ws.getRow(2);
  header.height = 28.2;
  HEADERS.forEach((text, i) => {
    const c = header.getCell(i + 1);
    c.value = text;
    c.font = { name: "Aptos Narrow", size: 11, bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = box;
  });

  let rowIndex = 3;
  for (const block of blocks) {
    const days = buildCalendarWeek(block.current, block.previous);
    for (const day of days) {
      const row = ws.getRow(rowIndex);
      row.height = 37.5;
      const values: (string | Date | { formula: string; result: number } | null)[] = [
        block.zoneName.toUpperCase(),
        { formula: `IF(C${rowIndex}<>"",_xlfn.ISOWEEKNUM(C${rowIndex}),"")`, result: block.current.week },
        excelDate(day.date),
        DAY_NAMES[day.weekday],
        comedorCellText(day, "breakfast", "main", catalog),
        comedorCellText(day, "lunch", "soup", catalog),
        comedorCellText(day, "lunch", "main", catalog),
        comedorCellText(day, "dinner", "main", catalog),
      ];
      values.forEach((v, i) => {
        const c = row.getCell(i + 1);
        c.value = v as never;
        c.border = box;
        if (i <= 3) {
          c.font = { name: "Aptos Narrow", size: i === 3 ? 10 : 8 };
          c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        } else {
          c.font = { name: "Arial", size: 6.5, color: { argb: "FF1B232F" } };
          c.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        }
      });
      row.getCell(3).numFmt = "dd/mm/yyyy";
      rowIndex++;
    }
  }
  ws.autoFilter = { from: "A2", to: `H${Math.max(rowIndex - 1, 2)}` };
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function exportComedorExcel(blocks: ComedorBlock[], catalog: Catalog, fileName?: string) {
  if (!blocks.length) return;
  const buffer = await buildComedorWorkbook(blocks, catalog);
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const weeks = Array.from(new Set(blocks.map((b) => b.current.week))).sort((x, y) => x - y).join("-");
  const zones = Array.from(new Set(blocks.map((b) => b.zoneName)));
  a.download = fileName ?? `Menu COMEDOR Semana ${weeks} ${safeFileName(zones.length > 3 ? `${zones.length} zonas` : zones.join(" + "))}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").replace(/\s+/g, " ").trim() || "Menu";
}
