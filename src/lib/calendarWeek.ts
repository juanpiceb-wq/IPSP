import { addDays, isoWeekMonday, toISODate } from "./dates";
import { cyclePosition } from "./rules";
import { WEEKDAYS } from "./types";
import type { MenuItem, Weekday } from "./types";

/**
 * Semana calendario de lunes a domingo para exportar (PDF / Excel).
 *
 * El ciclo operativo NO cambia: el Día 1 sigue siendo el día siguiente a la recepción
 * de víveres. Lo único que cambia es la forma de presentar la semana:
 *  - los días desde el inicio del ciclo hasta el domingo salen del menú de ESTA semana;
 *  - los días previos al inicio del ciclo (p. ej. lunes y martes con recepción el martes)
 *    son los días 6 y 7 del menú de la SEMANA ANTERIOR;
 *  - si la semana anterior no tiene menú guardado, esos días salen en blanco.
 * El domingo siempre pertenece al menú de la semana y conserva su menú fijo.
 */
export interface WeekMenuSource {
  year: number;
  week: number;
  arrival: Weekday;
  items: MenuItem[];
}

export type CalendarDaySource = "current" | "previous" | "none";

export interface CalendarDay {
  weekday: Weekday;
  label: string;
  /** Fecha ISO (aaaa-mm-dd) del día calendario. */
  date: string;
  source: CalendarDaySource;
  /** Posición dentro del ciclo del menú del que proviene (1..7). */
  position: number | null;
  /** Semana del menú del que proviene el día. */
  sourceWeek: number | null;
  sourceYear: number | null;
  items: MenuItem[];
}

/** Semana ISO anterior, calculada en UTC para no depender de la zona horaria del navegador. */
export function previousIsoWeek(year: number, week: number): { year: number; week: number } {
  return isoWeekOfUtc(addDays(isoWeekMonday(year, week), -7));
}

export function isoWeekOfUtc(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

/** Lunes y domingo calendario de la semana ISO. */
export function calendarRange(year: number, week: number): { start: string; end: string } {
  const monday = isoWeekMonday(year, week);
  return { start: toISODate(monday), end: toISODate(addDays(monday, 6)) };
}

export function buildCalendarWeek(current: WeekMenuSource, previous: WeekMenuSource | null): CalendarDay[] {
  const monday = isoWeekMonday(current.year, current.week);
  const cycleStart = addDays(monday, current.arrival + 1);
  return WEEKDAYS.map((d, index) => {
    const date = addDays(monday, index);
    const base = { weekday: d.value, label: d.label, date: toISODate(date) };
    if (date.getTime() >= cycleStart.getTime()) {
      return {
        ...base,
        source: "current" as const,
        position: cyclePosition(d.value, current.arrival),
        sourceWeek: current.week,
        sourceYear: current.year,
        items: current.items.filter((i) => i.weekday === d.value),
      };
    }
    if (previous) {
      return {
        ...base,
        source: "previous" as const,
        position: cyclePosition(d.value, previous.arrival),
        sourceWeek: previous.week,
        sourceYear: previous.year,
        items: previous.items.filter((i) => i.weekday === d.value),
      };
    }
    return { ...base, source: "none" as const, position: null, sourceWeek: null, sourceYear: null, items: [] };
  });
}

/** Busca, entre los menús guardados, el de la semana anterior del mismo campamento. */
export function findPreviousMenu<T extends { camp_id: string; year: number; week_number: number }>(
  menus: T[],
  campId: string,
  year: number,
  week: number,
): T | null {
  const prev = previousIsoWeek(year, week);
  return menus.find((m) => m.camp_id === campId && m.year === prev.year && m.week_number === prev.week) ?? null;
}
