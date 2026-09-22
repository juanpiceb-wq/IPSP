"use client";

import { formatDate } from "./dates";
import { WEEKDAYS } from "./types";
import type { Catalog, MainService, MenuItem, Parity, Weekday } from "./types";

interface ExportMenuPdfInput {
  items: MenuItem[];
  catalog: Catalog;
  week: number;
  parity: Parity;
  campId: string;
  campName?: string;
  diners: number;
  dinersLabel?: string;
  start: string | null;
  end: string | null;
}

type PdfColor = [number, number, number];

const PAGE_W = 841.89; // A4 landscape, pt
const PAGE_H = 595.28;
const MARGIN_X = 24;
const TOP = 28;
const BOTTOM = 24;
const FIRST_COL = 82;
const DAY_COL = (PAGE_W - MARGIN_X * 2 - FIRST_COL) / 7;

const NAVY: PdfColor = [11, 46, 79];
const BLUE: PdfColor = [28, 127, 196];
const PALE: PdfColor = [234, 243, 251];
const GRID: PdfColor = [211, 222, 232];
const INK: PdfColor = [27, 36, 48];
const MUTED: PdfColor = [90, 108, 122];
const WHITE: PdfColor = [255, 255, 255];

interface MenuPdfRow {
  kind: "section" | "data";
  label: string;
  values?: string[];
}

export function exportMenuPdf(input: ExportMenuPdfInput) {
  const bytes = buildMenuPdf(input);
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `menu_semana_${input.week}_${input.campId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function buildMenuPdf(input: ExportMenuPdfInput): Uint8Array {
  const { items, catalog, week, parity, campId, diners, start, end } = input;
  const campName = input.campName ?? catalog.camps.find((c) => c.id === campId)?.name ?? campId;

  const recipeName = (id: string | null | undefined) =>
    id ? catalog.recipes.find((r) => r.id === id)?.name ?? "" : "";

  const find = (w: Weekday, service: MainService, component: "main" | "soup") =>
    items.find((i) => i.weekday === w && i.service === service && i.component === component);

  const values = (
    service: MainService,
    component: "main" | "soup",
    field: "recipe" | "salad" | "beverage"
  ) =>
    WEEKDAYS.map((d) => {
      if (service === "lunch" && component === "soup" && d.value === 6) return "No aplica";
      const item = find(d.value, service, component);
      if (!item) return "-";
      if (field === "recipe") return recipeName(item.recipe_id) || "-";
      if (field === "salad") return recipeName(item.salad_recipe_id) || "Sin ensalada";
      return item.beverage || "-";
    });

  const rows: MenuPdfRow[] = [
    { kind: "section", label: "DESAYUNO" },
    { kind: "data", label: "Plato fuerte", values: values("breakfast", "main", "recipe") },
    { kind: "data", label: "Bebida", values: values("breakfast", "main", "beverage") },
    { kind: "section", label: "ALMUERZO" },
    { kind: "data", label: "Sopa", values: values("lunch", "soup", "recipe") },
    { kind: "data", label: "Plato fuerte", values: values("lunch", "main", "recipe") },
    { kind: "data", label: "Ensalada", values: values("lunch", "main", "salad") },
    { kind: "data", label: "Bebida", values: values("lunch", "main", "beverage") },
    { kind: "section", label: "CENA" },
    { kind: "data", label: "Plato fuerte", values: values("dinner", "main", "recipe") },
    { kind: "data", label: "Ensalada", values: values("dinner", "main", "salad") },
    { kind: "data", label: "Bebida", values: values("dinner", "main", "beverage") },
  ];

  const content: string[] = [];
  const push = (s: string) => content.push(s);

  const title = "MENU SEMANAL";
  drawText(push, title, MARGIN_X, TOP, 15, NAVY, true);
  drawText(
    push,
    `${campName} - Semana ${week} (${parity.toUpperCase()})`,
    MARGIN_X,
    TOP + 17,
    10.5,
    NAVY,
    true
  );
  const vigencia = start && end ? ` | Vigencia: ${formatDate(start)} - ${formatDate(end)}` : "";
  drawText(push, `${input.dinersLabel ?? `${diners} comensales`}${vigencia}`, MARGIN_X, TOP + 31, 8.2, MUTED, false);

  let y = TOP + 43;
  const headerH = 19;
  drawRect(push, MARGIN_X, y, FIRST_COL, headerH, BLUE, BLUE, true);
  drawCellText(push, "SERVICIO", MARGIN_X, y, FIRST_COL, headerH, 7.2, WHITE, true, "center");
  WEEKDAYS.forEach((d, idx) => {
    const x = MARGIN_X + FIRST_COL + idx * DAY_COL;
    drawRect(push, x, y, DAY_COL, headerH, BLUE, BLUE, true);
    drawCellText(push, d.label.toUpperCase(), x, y, DAY_COL, headerH, 7.2, WHITE, true, "center");
  });
  y += headerH;

  const bodyFont = 6.8;
  const lineH = 7.8;

  for (const row of rows) {
    if (row.kind === "section") {
      const h = 15;
      drawRect(push, MARGIN_X, y, PAGE_W - MARGIN_X * 2, h, NAVY, NAVY, true);
      drawCellText(push, row.label, MARGIN_X + 4, y, PAGE_W - MARGIN_X * 2 - 8, h, 7.4, WHITE, true, "left");
      y += h;
      continue;
    }

    const wrapped = (row.values ?? []).map((v) => wrapText(v, DAY_COL - 7, bodyFont));
    const maxLines = Math.max(1, ...wrapped.map((w) => w.length));
    const rowH = Math.max(17, maxLines * lineH + 6);

    drawRect(push, MARGIN_X, y, FIRST_COL, rowH, PALE, GRID, true);
    drawCellText(push, row.label, MARGIN_X + 4, y, FIRST_COL - 8, rowH, 7, NAVY, true, "left");

    wrapped.forEach((lines, idx) => {
      const x = MARGIN_X + FIRST_COL + idx * DAY_COL;
      drawRect(push, x, y, DAY_COL, rowH, WHITE, GRID, true);
      drawMultiline(push, lines, x + 3.5, y, DAY_COL - 7, rowH, bodyFont, INK, lineH);
    });
    y += rowH;
  }

  // Footer discreto, independiente del contenido administrativo de la app.
  const footerY = PAGE_H - BOTTOM + 2;
  drawLine(push, MARGIN_X, footerY - 9, PAGE_W - MARGIN_X, footerY - 9, GRID, 0.6);
  drawText(push, "Todos los servicios incluyen arroz.", MARGIN_X, footerY, 6.8, MUTED, false);
  drawTextRight(
    push,
    "Master User: Juan Pablo Ceballos",
    PAGE_W - MARGIN_X,
    footerY,
    6.5,
    MUTED,
    false
  );

  // Si algún nombre excepcionalmente largo empuja la tabla hacia abajo, el PDF sigue
  // siendo de una sola página; el tamaño anterior está pensado para el catálogo actual.
  const streamBytes = encodeWinAnsi(content.join("\n"));
  return makePdf(streamBytes);
}

function drawRect(
  push: (s: string) => void,
  x: number,
  top: number,
  w: number,
  h: number,
  fill: PdfColor,
  stroke: PdfColor,
  doFill: boolean
) {
  const y = PAGE_H - top - h;
  push(`${rgb(fill, false)} ${rgb(stroke, true)} 0.45 w ${n(x)} ${n(y)} ${n(w)} ${n(h)} re ${doFill ? "B" : "S"}`);
}

function drawLine(
  push: (s: string) => void,
  x1: number,
  top1: number,
  x2: number,
  top2: number,
  color: PdfColor,
  width: number
) {
  push(`${rgb(color, true)} ${n(width)} w ${n(x1)} ${n(PAGE_H - top1)} m ${n(x2)} ${n(PAGE_H - top2)} l S`);
}

function drawText(
  push: (s: string) => void,
  text: string,
  x: number,
  topBaseline: number,
  size: number,
  color: PdfColor,
  bold: boolean
) {
  push(
    `BT ${rgb(color, false)} /${bold ? "F2" : "F1"} ${n(size)} Tf 1 0 0 1 ${n(x)} ${n(
      PAGE_H - topBaseline
    )} Tm (${pdfEscape(text)}) Tj ET`
  );
}

function drawTextRight(
  push: (s: string) => void,
  text: string,
  rightX: number,
  topBaseline: number,
  size: number,
  color: PdfColor,
  bold: boolean
) {
  const width = approximateTextWidth(text, size, bold);
  drawText(push, text, rightX - width, topBaseline, size, color, bold);
}

function drawCellText(
  push: (s: string) => void,
  text: string,
  x: number,
  top: number,
  w: number,
  h: number,
  size: number,
  color: PdfColor,
  bold: boolean,
  align: "left" | "center"
) {
  const width = approximateTextWidth(text, size, bold);
  const tx = align === "center" ? x + Math.max(3, (w - width) / 2) : x;
  const baselineTop = top + h / 2 + size * 0.34;
  drawText(push, text, tx, baselineTop, size, color, bold);
}

function drawMultiline(
  push: (s: string) => void,
  lines: string[],
  x: number,
  top: number,
  _w: number,
  h: number,
  size: number,
  color: PdfColor,
  lineH: number
) {
  const total = lines.length * lineH;
  const firstBaseline = top + Math.max(size + 3, (h - total) / 2 + size);
  lines.forEach((line, idx) => drawText(push, line, x, firstBaseline + idx * lineH, size, color, false));
}

function wrapText(text: string, width: number, fontSize: number): string[] {
  const clean = (text || "-").replace(/\s+/g, " ").trim();
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (approximateTextWidth(trial, fontSize, false) <= width || !current) {
      current = trial;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["-"];
}

function approximateTextWidth(text: string, fontSize: number, bold: boolean): number {
  // Helvetica aproximada. Suficiente para ajuste de la tabla; prioriza no cortar texto.
  const factor = bold ? 0.54 : 0.5;
  return text.length * fontSize * factor;
}

function rgb(c: PdfColor, stroke: boolean): string {
  const v = c.map((x) => (x / 255).toFixed(3)).join(" ");
  return `${v} ${stroke ? "RG" : "rg"}`;
}

function n(v: number): string {
  return Number(v.toFixed(2)).toString();
}

function pdfEscape(text: string): string {
  return text
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function encodeWinAnsi(text: string): Uint8Array {
  const replacements: Record<number, number> = {
    0x20ac: 0x80,
    0x201a: 0x82,
    0x0192: 0x83,
    0x201e: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x02c6: 0x88,
    0x2030: 0x89,
    0x0160: 0x8a,
    0x2039: 0x8b,
    0x0152: 0x8c,
    0x017d: 0x8e,
    0x2018: 0x91,
    0x2019: 0x92,
    0x201c: 0x93,
    0x201d: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x02dc: 0x98,
    0x2122: 0x99,
    0x0161: 0x9a,
    0x203a: 0x9b,
    0x0153: 0x9c,
    0x017e: 0x9e,
    0x0178: 0x9f,
  };
  const out: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 63;
    if (code <= 255) out.push(code);
    else out.push(replacements[code] ?? 63);
  }
  return Uint8Array.from(out);
}

function ascii(text: string): Uint8Array {
  return Uint8Array.from(Array.from(text).map((c) => c.charCodeAt(0) & 0xff));
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function makePdf(stream: Uint8Array): Uint8Array {
  const header = Uint8Array.from([
    ...ascii("%PDF-1.4\n").values(),
    0x25,
    0xe2,
    0xe3,
    0xcf,
    0xd3,
    0x0a,
  ]);

  const objects: Uint8Array[] = [];
  objects[1] = ascii("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2] = ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects[3] = ascii(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(PAGE_W)} ${n(
      PAGE_H
    )}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`
  );
  objects[4] = ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects[5] = ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  objects[6] = concat([ascii(`<< /Length ${stream.length} >>\nstream\n`), stream, ascii("\nendstream")]);

  const parts: Uint8Array[] = [header];
  const offsets: number[] = [0];
  let current = header.length;
  for (let i = 1; i <= 6; i++) {
    offsets[i] = current;
    const wrapped = concat([ascii(`${i} 0 obj\n`), objects[i], ascii("\nendobj\n")]);
    parts.push(wrapped);
    current += wrapped.length;
  }

  const xrefOffset = current;
  let xref = "xref\n0 7\n0000000000 65535 f \n";
  for (let i = 1; i <= 6; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  parts.push(ascii(xref));
  return concat(parts);
}
