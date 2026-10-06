import type { Weekday } from "./types";

export const OPERATING_TIME_ZONE = "America/Guayaquil";

/** Fecha calendario operativa de IPSP en Ecuador (YYYY-MM-DD). */
export function operatingISODate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: OPERATING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "00";
  const day = parts.find((p) => p.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
}

/** Compara fechas de negocio sin depender de la zona horaria de Vercel o del navegador. */
export function hasDateStarted(iso: string | null | undefined, now: Date = new Date()): boolean {
  return !!iso && operatingISODate(now) >= iso;
}

/** Lunes de la semana ISO indicada. */
export function isoWeekMonday(year: number, week: number): Date {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay() || 7; // 1..7 (lunes..domingo)
  const monday = new Date(simple);
  monday.setUTCDate(simple.getUTCDate() - dow + 1);
  return monday;
}

/** Semana ISO según la fecha calendario operativa de Ecuador. */
export function isoWeekOf(date: Date): { year: number; week: number } {
  const [year, month, day] = operatingISODate(date).split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d} ${meses[(m || 1) - 1]} ${y}`;
}

/**
 * Ciclo real de uso: empieza el día siguiente a la recepción de víveres
 * dentro de la semana indicada y dura 7 días.
 */
export function cycleDates(year: number, week: number, arrival: Weekday) {
  const monday = isoWeekMonday(year, week);
  const start = addDays(monday, arrival + 1);
  const end = addDays(start, 6);
  return { start: toISODate(start), end: toISODate(end) };
}
