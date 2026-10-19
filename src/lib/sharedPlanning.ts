import { blockingReason, buildContext, buildHistoryIndex } from "./engine/context";
import { previousIsoWeek } from "./calendarWeek";
import { cycleOrder, projectWeekday } from "./rules";
import type { Catalog, MainService, MenuItem, Parity, Weekday, WeeklyMenu } from "./types";
import { finalizeMenu, type EligibleSlot } from "./menuFinalizer";
import { buildExactProteinPlan, type ProteinSlot } from "./proteinPlanner";

/**
 * Planificación de un menú maestro compartido por campamentos con distintos días de recepción.
 * Una preparación solo es elegible en un espacio si lo es en TODAS las recepciones activas,
 * evaluada en el día real al que se proyecta (verde días 1-4, maduro desde el 5,
 * pata/costilla desde el 4, domingo fijo, etc.).
 */
export function activeArrivals(catalog: Catalog): Weekday[] {
  return [...new Set(catalog.camps.filter((c) => c.active).map((c) => c.reception_weekday_default as Weekday))];
}

export function buildSharedEligibleSlots(args: {
  catalog: Catalog; parity: Parity; arrival: Weekday; arrivals: Weekday[];
  history: WeeklyMenu[]; year: number; week: number; campId: string;
}): EligibleSlot[] {
  const { catalog, parity, arrival } = args;
  const targets = [arrival, ...args.arrivals.filter((a) => a !== arrival)];
  const contexts = targets.map((target) => {
    const camp = catalog.camps.find((c) => c.active && c.reception_weekday_default === target);
    const hist = buildHistoryIndex(args.history, args.year, args.week, target === arrival ? args.campId : camp?.id ?? args.campId, catalog);
    return { target, ctx: buildContext(catalog, parity, target, hist) };
  });
  const eligible = (recipe: Catalog["recipes"][number], service: MainService | "soup", day: Weekday) =>
    contexts.every(({ target, ctx }) => !blockingReason(recipe, service, projectWeekday(day, arrival, target), ctx));
  const out: EligibleSlot[] = [];
  for (let d = 0; d < 7; d++) {
    const day = d as Weekday;
    for (const service of ["breakfast", "lunch", "dinner"] as MainService[]) {
      out.push({
        weekday: d, service, component: "main",
        ids: catalog.recipes.filter((r) => r.active && !!r.primary_protein_id && !r.services.includes("salad") && eligible(r, service, day)).map((r) => r.id),
      });
    }
    if (d < 6) out.push({ weekday: d, service: "lunch", component: "soup", ids: catalog.recipes.filter((r) => r.active && eligible(r, "soup", day)).map((r) => r.id) });
  }
  return out;
}

/** Menú guardado de la semana anterior del mismo campamento. */
export function previousWeekMenu(history: WeeklyMenu[], campId: string, year: number, week: number): WeeklyMenu | null {
  const prev = previousIsoWeek(year, week);
  return history.find((m) => m.camp_id === campId && m.year === prev.year && m.week_number === prev.week) ?? null;
}

/** Proteínas (platos fuertes y sopa) servidas el Día 7 del menú indicado. */
export function lastDayProteins(menu: WeeklyMenu | null): { mains: string[]; soups: string[] } {
  if (!menu) return { mains: [], soups: [] };
  const lastDay = cycleOrder(menu.supply_arrival_weekday)[6];
  const at = (component: "main" | "soup") => menu.items
    .filter((i: MenuItem) => i.weekday === lastDay && i.component === component && !!i.protein_id)
    .map((i) => i.protein_id!);
  return { mains: at("main"), soups: at("soup") };
}

/**
 * Busca un reparto de proteínas para el que exista una combinación completa de preparaciones
 * (plato único, dificultad, bases, salsas y sopas) en todas las recepciones. Prueba el reparto
 * base y, si no cierra, variantes reproducibles del planificador.
 */
export function planFeasibleMenu(args: {
  catalog: Catalog; parity: Parity; arrival: Weekday; arrivals: Weekday[];
  eligibleBySlot: EligibleSlot[]; locked?: MenuItem[];
  previous: { mains: string[]; soups: string[] }; recencyPenalty?: Record<string, number>;
  seedBase: string; attempts?: number; budgetMs?: number;
}): { plan: ProteinSlot[]; eligibleBySlot: EligibleSlot[]; attempt: number } {
  const recipeById = new Map(args.catalog.recipes.map((r) => [r.id, r]));
  const started = Date.now();
  let lastError: unknown = null;
  for (let attempt = 0; attempt < (args.attempts ?? 40); attempt++) {
    if (attempt > 0 && Date.now() - started > (args.budgetMs ?? 20000)) break;
    try {
      const plan = buildExactProteinPlan({
        catalog: args.catalog, parity: args.parity, arrival: args.arrival, eligibleBySlot: args.eligibleBySlot,
        locked: args.locked, arrivals: args.arrivals, previousLastDayProteins: args.previous.mains,
        seed: attempt === 0 ? undefined : `${args.seedBase}-${attempt}`,
      });
      const planMap = new Map(plan.map((x) => [`${x.weekday}|${x.service}`, x.proteinId]));
      const eligible = args.eligibleBySlot.map((s) => s.component !== "main" ? { ...s, ids: [...s.ids] } : {
        ...s, ids: s.ids.filter((id) => recipeById.get(id)?.primary_protein_id === planMap.get(`${s.weekday}|${s.service}`)),
      });
      finalizeMenu({
        catalog: args.catalog, parity: args.parity, arrival: args.arrival, eligibleBySlot: eligible, proteinPlan: plan,
        preferences: [], locked: args.locked, recencyPenalty: args.recencyPenalty, arrivals: args.arrivals,
        previousLastDaySoupProteins: args.previous.soups,
      });
      return { plan, eligibleBySlot: eligible, attempt };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No se encontró un reparto de proteínas que cierre con preparaciones válidas.");
}
