import type {
  Catalog,
  MainService,
  Parity,
  Protein,
  Recipe,
  RestrictiveProduct,
  Service,
  Weekday,
  WeeklyMenu,
} from "../types";
import { RULES, cyclePosition } from "../rules";

export interface HistoryIndex {
  recipeAgo: Map<string, number>;
  recipeSlotAgo: Map<string, number>;
  proteinAgo: Map<string, number>;
  proteinSlotAgo: Map<string, number>;
  baseAgo: Map<string, number>;
  weeksAnalyzed: number;
}

export function weekIndex(year: number, week: number) {
  return year * 53 + week;
}

export function buildHistoryIndex(
  history: WeeklyMenu[],
  year: number,
  week: number,
  campId?: string,
  catalog?: Catalog
): HistoryIndex {
  const current = weekIndex(year, week);
  const recipeAgo = new Map<string, number>();
  const recipeSlotAgo = new Map<string, number>();
  const proteinAgo = new Map<string, number>();
  const proteinSlotAgo = new Map<string, number>();
  const baseAgo = new Map<string, number>();
  const recipeById = new Map((catalog?.recipes ?? []).map((r) => [r.id, r]));

  const relevant = history
    .filter((m) => (campId ? m.camp_id === campId : true))
    .map((m) => ({ m, ago: current - weekIndex(m.year, m.week_number) }))
    .filter((x) => x.ago > 0 && x.ago <= RULES.HISTORY_WEEKS)
    .sort((a, b) => a.ago - b.ago);

  const weeksAnalyzed = new Set(relevant.map((x) => x.ago)).size;

  for (const { m, ago } of relevant) {
    for (const it of m.items) {
      if (it.recipe_id) {
        keepMin(recipeAgo, it.recipe_id, ago);
        keepMin(recipeSlotAgo, `${it.recipe_id}|${it.weekday}|${it.service}|${it.component}`, ago);
        const base = recipeById.get(it.recipe_id)?.base_ingredient;
        if (base && isMeaningfulBase(base)) keepMin(baseAgo, base, ago);
      }
      if (it.protein_id) {
        keepMin(proteinAgo, it.protein_id, ago);
        keepMin(proteinSlotAgo, `${it.protein_id}|${it.weekday}|${it.service}`, ago);
      }
      if (it.salad_recipe_id) keepMin(recipeAgo, it.salad_recipe_id, ago);
    }
  }
  return { recipeAgo, recipeSlotAgo, proteinAgo, proteinSlotAgo, baseAgo, weeksAnalyzed };
}

function keepMin(map: Map<string, number>, key: string, value: number) {
  const cur = map.get(key);
  if (cur === undefined || value < cur) map.set(key, value);
}

export function recencyWeight(ago: number | undefined): number {
  if (ago === undefined) return 0;
  const w = (RULES.HISTORY_WEEKS + 1 - ago) / RULES.HISTORY_WEEKS;
  return Math.max(0, Math.min(1, w));
}

export interface EngineContext {
  parity: Parity;
  arrival: Weekday;
  proteinsById: Map<string, Protein>;
  productsById: Map<string, RestrictiveProduct>;
  recipesById: Map<string, Recipe>;
  history: HistoryIndex;
  sundayLunchRecipeId: string | null;
}

export function buildContext(
  catalog: Catalog,
  parity: Parity,
  arrival: Weekday,
  history: HistoryIndex
): EngineContext {
  const sundayLunch = catalog.recipes.find(
    (r) => r.active && r.fixed_weekday === 6 && r.fixed_service === "lunch"
  );
  return {
    parity,
    arrival,
    proteinsById: new Map(catalog.proteins.map((x) => [x.id, x])),
    productsById: new Map(catalog.products.map((x) => [x.id, x])),
    recipesById: new Map(catalog.recipes.map((x) => [x.id, x])),
    history,
    sundayLunchRecipeId: sundayLunch?.id ?? null,
  };
}

export function blockingReason(
  recipe: Recipe,
  service: Service,
  weekday: Weekday,
  ctx: EngineContext
): string | null {
  if (!recipe.active) return "La preparación está desactivada.";
  const operationalBreakfast = service === "breakfast"
    && !!recipe.primary_protein_id
    && recipe.primary_protein_id !== "sardina"
    && !recipe.double_fry
    && !recipe.services.includes("soup")
    && !recipe.services.includes("salad")
    && (recipe.services.includes("lunch") || recipe.services.includes("dinner"));
  const sardineCorvicheBreakfast = service === "breakfast" && recipe.id === "corviche-de-sardina";
  if (!recipe.services.includes(service) && !operationalBreakfast && !sardineCorvicheBreakfast)
    return `“${recipe.name}” no está habilitada para este servicio.`;

  if (recipe.only_weekday !== null && recipe.only_weekday !== undefined && recipe.only_weekday !== weekday)
    return `“${recipe.name}” solo puede utilizarse el ${weekdayLabel(recipe.only_weekday)}.`;
  if (recipe.fixed_weekday !== null && recipe.fixed_weekday !== undefined) {
    if (recipe.fixed_weekday !== weekday || recipe.fixed_service !== service)
      return `“${recipe.name}” está reservada para ${weekdayLabel(recipe.fixed_weekday)} al ${serviceLabel(recipe.fixed_service ?? "lunch")}.`;
  }

  // Los domingos no se sirve sopa.
  if (weekday === 6 && service === "soup")
    return "Los domingos no se sirve sopa.";

  // Almuerzo dominical: el único plato fuerte permitido es el ceviche fijo del maestro.
  if (weekday === 6 && service === "lunch" && ctx.sundayLunchRecipeId && recipe.id !== ctx.sundayLunchRecipeId)
    return "El almuerzo del domingo está fijado como ceviche de pescado con chifle.";
  if (weekday === 6 && service === "dinner" && !recipe.sunday_roast)
    return "La cena del domingo debe ser una preparación asada habilitada para domingo.";
  if (recipe.double_fry && service !== "dinner")
    return "Las preparaciones con doble fritura solo pueden programarse en cena.";

  const protein = recipe.primary_protein_id ? ctx.proteinsById.get(recipe.primary_protein_id) : null;

  // Regla operativa: fritada y chuleta de cerdo nunca se programan en desayuno.
  if (service === "breakfast" && (recipe.primary_protein_id === "fritada" || recipe.primary_protein_id === "chuleta-cerdo"))
    return recipe.primary_protein_id === "fritada"
      ? "Fritada no puede utilizarse en desayuno."
      : "Chuleta de cerdo no puede utilizarse en desayuno.";

  if (protein) {
    if (!protein.active) return `La proteína ${protein.name} está desactivada.`;
    if ((protein.breakfast_only || protein.id === "atun" || protein.id === "huevo") && service !== "breakfast")
      return `${protein.name} solo puede utilizarse en desayunos.`;
    if (protein.id === "sardina") {
      const corvicheBreakfast = recipe.id === "corviche-de-sardina" && service === "breakfast";
      if (service !== "lunch" && !corvicheBreakfast)
        return "Sardina solo puede utilizarse en almuerzo; Corviche de sardina es la única excepción permitida en desayuno.";
    }
    const operationalSoupOnly = protein.soup_only || ["hueso-carnudo", "costilla-res", "pata-res"].includes(protein.id);
    if (operationalSoupOnly && service !== "soup") return `${protein.name} solo puede utilizarse en sopa.`;
    if (!operationalSoupOnly && service === "soup") return "En sopa solo pueden usarse hueso carnudo, costilla o pata.";
    const hardProteinParity = protein.id === "costilla-res" || protein.id === "atun" ? "par"
      : protein.id === "pata-res" || protein.id === "sardina" ? "impar"
      : protein.parity;
    if (hardProteinParity !== "todas" && hardProteinParity !== ctx.parity)
      return `${protein.name} corresponde a semana ${hardProteinParity} y esta es semana ${ctx.parity}.`;

    // Las 20 lb de filete se reservan primero para el ceviche dominical obligatorio.
    if (protein.id === "tilapia" && ctx.sundayLunchRecipeId && recipe.id !== ctx.sundayLunchRecipeId)
      return "La Tilapia disponible está reservada para el ceviche obligatorio del domingo.";
  } else if (service === "soup") {
    // sopa sin proteína animal: permitida
  }

  // Validamos tanto las relaciones guardadas como restricciones implícitas por nombre/base/proteína.
  // Esto protege el motor incluso si una receta antigua de Supabase quedó sin su relación
  // recipe_restrictive_products después de una migración.
  for (const pid of effectiveRestrictiveProductIds(recipe)) {
    const prod = ctx.productsById.get(pid);
    if (!prod || !prod.active) continue;
    const hardParity = HARD_PRODUCT_PARITY[pid] ?? prod.parity;
    if (hardParity !== "todas" && hardParity !== ctx.parity)
      return `${prod.name} no está disponible en semana ${ctx.parity}.`;
    if (prod.arrival_weekday !== null) {
      const pos = cyclePosition(weekday, ctx.arrival);
      const minPos = cyclePosition(prod.arrival_weekday, ctx.arrival) + 1;
      if (pos < minPos) return `${prod.name} llega ese día y no puede programarse antes.`;
    }
  }

  const pos = cyclePosition(weekday, ctx.arrival);
  const greenPlantain = usesGreenPlantain(recipe);
  const ripePlantain = usesRipePlantain(recipe);

  // Ciclo operativo vigente:
  // día 1-3 después de la recepción = verde;
  // desde el día 4 = maduro.
  // El ceviche dominical conserva la excepción de chifle reservado/procesado
  // dentro de la ventana válida de verde.
  if (greenPlantain && recipe.id !== ctx.sundayLunchRecipeId && pos > RULES.GREEN_PLANTAIN_DAYS)
    return `Las preparaciones con verde solo pueden programarse en los primeros ${RULES.GREEN_PLANTAIN_DAYS} días del ciclo después de recepción.`;
  if (ripePlantain && pos <= RULES.GREEN_PLANTAIN_DAYS)
    return `Las preparaciones con maduro solo pueden programarse desde el día ${RULES.GREEN_PLANTAIN_DAYS + 1} del ciclo después de recepción.`;

  return null;
}

export function isEligible(recipe: Recipe, service: Service, weekday: Weekday, ctx: EngineContext): boolean {
  return blockingReason(recipe, service, weekday, ctx) === null;
}

/**
 * Restricciones defensivas inferidas del plato. La fuente principal sigue siendo
 * `restrictive_product_ids`, pero esta capa evita que recetas antiguas o creadas
 * antes de una migración salten las reglas de paridad.
 */
const HARD_PRODUCT_PARITY: Record<string, "todas" | Parity> = {
  "aji": "par",
  "canela": "par",
  "comino": "par",
  "pimienta-negra": "par",
  "sazonador-la-sazon": "par",
  "costilla-res-prod": "par",
  "coliflor": "par",
  "remolacha": "par",
  "verdura": "par",
  "atun-real": "par",
  "tallarin": "par",
  "fideos": "par",
  "quaker": "par",
  "pata-res-prod": "impar",
  "garbanzo": "impar",
  "mote": "impar",
  "brocoli": "impar",
  "pepino": "impar",
  "rabano": "impar",
  "sardina-prod": "impar",
};

export function effectiveRestrictiveProductIds(recipe: Recipe): string[] {
  const ids = new Set(recipe.restrictive_product_ids ?? []);
  const text = normalize(`${recipe.name} ${recipe.base_ingredient ?? ""}`);

  const addIf = (test: boolean, id: string) => { if (test) ids.add(id); };
  addIf(recipe.primary_protein_id === "costilla-res" || text.includes("costilla de res"), "costilla-res-prod");
  addIf(recipe.primary_protein_id === "pata-res" || text.includes("pata de res"), "pata-res-prod");
  addIf(recipe.primary_protein_id === "atun" || text.includes("atun"), "atun-real");
  addIf(recipe.primary_protein_id === "sardina" || text.includes("sardina"), "sardina-prod");

  addIf(text.includes("fideo") || text.includes("tallarin") || text.includes("pasta"), "tallarin");
  addIf(text.includes("coliflor"), "coliflor");
  addIf(text.includes("brocoli"), "brocoli");
  addIf(text.includes("pepino"), "pepino");
  addIf(text.includes("rabano"), "rabano");
  addIf(text.includes("remolacha"), "remolacha");
  addIf(text.includes("garbanzo"), "garbanzo");
  addIf(text.includes("mote"), "mote");
  addIf(text.includes("quaker") || text.includes("avena"), "quaker");
  addIf(text.includes("aji"), "aji");
  addIf(text.includes("canela"), "canela");
  addIf(text.includes("comino"), "comino");
  addIf(text.includes("pimienta negra"), "pimienta-negra");
  addIf(text.includes("la sazon"), "sazonador-la-sazon");
  addIf(text.includes("verdura"), "verdura");

  return [...ids];
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function usesGreenPlantain(recipe: Recipe) {
  if (recipe.base_ingredient === "Plátano verde") return true;
  const text = normalize(`${recipe.name} ${recipe.base_ingredient ?? ""}`);
  return /\bverde\b/.test(text)
    || /\bpatacon(?:es)?\b/.test(text)
    || /\bbolon\b/.test(text)
    || /\btigrillo\b/.test(text)
    || /\bcorviche\b/.test(text)
    || /\bchifle(?:s)?\b/.test(text);
}

function usesRipePlantain(recipe: Recipe) {
  if (recipe.base_ingredient === "Plátano maduro") return true;
  const text = normalize(`${recipe.name} ${recipe.base_ingredient ?? ""}`);
  return /\bmaduro(?:s)?\b/.test(text)
    || /\btajada(?:s)? de maduro\b/.test(text);
}

export function isMeaningfulBase(base: string | null | undefined) {
  return !!base && base !== "Sin base dominante" && base !== "Arroz especial";
}

function weekdayLabel(day: Weekday) {
  return ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"][day];
}
function serviceLabel(service: MainService) {
  return service === "breakfast" ? "desayuno" : service === "lunch" ? "almuerzo" : "cena";
}

/** Determinista: misma semilla → mismo menú. */
export function makeRng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MAIN_SERVICE_ORDER: MainService[] = ["breakfast", "lunch", "dinner"];
/**
 * Clave semanal del plato.
 * Para nombres distintivos toma el concepto antes de "de"/"con"/"relleno".
 * Ej.: "Ceviche de camarón" y "Ceviche de tilapia" => "family:ceviche".
 * Evita agrupar raíces demasiado genéricas como arroz, sopa o caldo.
 */
const GENERIC_DISH_ROOTS = new Set([
  "arroz","sopa","caldo","ensalada","guiso","menestra","moro","seco",
  "carne","pollo","cerdo","chuleta","huevo","tortilla","pescado","papa","pure"
]);

export function weeklyDishKey(name: string): string {
  const clean = normalize(name)
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "exact:";
  const root = clean.split(/\b(?:de|con|relleno|rellena|acompanado|acompanada|y)\b/)[0].trim();
  const first = root.split(" ")[0] ?? "";
  if (root && first && !GENERIC_DISH_ROOTS.has(first)) return `family:${root}`;
  return `exact:${clean}`;
}

