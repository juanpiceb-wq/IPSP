import type { Catalog, MenuItem, Recipe, Weekday } from "./types";
import { cyclePosition } from "./rules";

export const SALAD_STOCK_ID = "ensalada-segun-stock";

export const SALAD_INGREDIENT_LIMITS: Record<string, { label: string; max: number }> = {
  tomate: { label: "Tomate", max: 4 },
  "cebolla-colorada": { label: "Cebolla colorada", max: 4 },
  zanahoria: { label: "Zanahoria", max: 4 },
  pimiento: { label: "Pimiento", max: 4 },
  col: { label: "Col", max: 2 },
  pepino: { label: "Pepino", max: 2 },
  remolacha: { label: "Remolacha", max: 2 },
  "cebolla-blanca": { label: "Cebolla blanca", max: 2 },
  cilantro: { label: "Cilantro / hierbitas", max: 2 },
  brocoli: { label: "Brócoli", max: 1 },
  coliflor: { label: "Coliflor", max: 1 },
  rabano: { label: "Rábano", max: 1 },
  nabo: { label: "Nabo", max: 1 },
  albahaca: { label: "Albahaca", max: 1 },
};

type SaladSpec = {
  id: string;
  name: string;
  ingredients: string[];
  restrictive?: string[];
};

const SPECS: SaladSpec[] = [
  { id: "ens-tomate-cebolla-colorada", name: "Ensalada de tomate y cebolla colorada", ingredients: ["tomate","cebolla-colorada"] },
  { id: "ens-tomate-zanahoria", name: "Ensalada de tomate y zanahoria", ingredients: ["tomate","zanahoria"] },
  { id: "ens-tomate-pimiento", name: "Ensalada de tomate y pimiento", ingredients: ["tomate","pimiento"] },
  { id: "ens-tomate-cilantro", name: "Ensalada de tomate y cilantro", ingredients: ["tomate","cilantro"] },
  { id: "ens-col-zanahoria", name: "Ensalada de col y zanahoria", ingredients: ["col","zanahoria"] },
  { id: "ens-col-cebolla-colorada", name: "Ensalada de col y cebolla colorada", ingredients: ["col","cebolla-colorada"] },
  { id: "ens-col-pimiento", name: "Ensalada de col y pimiento", ingredients: ["col","pimiento"] },
  { id: "ens-col-cilantro", name: "Ensalada de col y cilantro", ingredients: ["col","cilantro"] },
  { id: "ens-zanahoria-cebolla-blanca", name: "Ensalada de zanahoria y cebolla blanca", ingredients: ["zanahoria","cebolla-blanca"] },
  { id: "ens-zanahoria-cilantro", name: "Ensalada de zanahoria y cilantro", ingredients: ["zanahoria","cilantro"] },
  { id: "ens-pimiento-cebolla-colorada", name: "Ensalada de pimiento y cebolla colorada", ingredients: ["pimiento","cebolla-colorada"] },
  { id: "ens-pimiento-albahaca", name: "Ensalada de pimiento y albahaca", ingredients: ["pimiento","albahaca"] },
  { id: "ens-remolacha-cebolla-colorada", name: "Ensalada de remolacha y cebolla colorada", ingredients: ["remolacha","cebolla-colorada"], restrictive: ["remolacha"] },
  { id: "ens-remolacha-cebolla-blanca", name: "Ensalada de remolacha y cebolla blanca", ingredients: ["remolacha","cebolla-blanca"], restrictive: ["remolacha"] },
  { id: "ens-coliflor-albahaca", name: "Ensalada de coliflor y albahaca", ingredients: ["coliflor","albahaca"], restrictive: ["coliflor"] },
  { id: "ens-remolacha-cilantro", name: "Ensalada de remolacha y cilantro", ingredients: ["remolacha","cilantro"], restrictive: ["remolacha"] },
  { id: "ens-pepino-cebolla-blanca", name: "Ensalada de pepino y cebolla blanca", ingredients: ["pepino","cebolla-blanca"], restrictive: ["pepino"] },
  { id: "ens-pepino-rabano", name: "Ensalada de pepino y rábano", ingredients: ["pepino","rabano"], restrictive: ["pepino","rabano"] },
  { id: "ens-pepino-brocoli", name: "Ensalada de pepino y brócoli", ingredients: ["pepino","brocoli"], restrictive: ["pepino","brocoli"] },
  { id: "ens-nabo-cebolla-blanca", name: "Ensalada de nabo y cebolla blanca", ingredients: ["nabo","cebolla-blanca"] },
];

export const FINAL_SALAD_RECIPES: Recipe[] = [
  ...SPECS.map((s) => ({
    id: s.id,
    name: s.name,
    primary_protein_id: null,
    services: ["salad"] as Recipe["services"],
    restrictive_product_ids: s.restrictive ?? [],
    active: true,
    source: "Regla operativa IPSP · ensaladas 2026-09-28",
    notes: `Ingredientes principales: ${s.ingredients.map((x) => SALAD_INGREDIENT_LIMITS[x]?.label ?? x).join(" + ")}. Preparación simple; 2 ingredientes principales.`,
    base_ingredient: null,
    difficulty: 1 as const,
    cooking_method: "Ensalada",
    double_fry: false,
    sunday_roast: false,
    base_qty_per_person: null,
    base_unit: null,
    protein_qty_per_person: null,
    protein_unit: null,
    rice_mode: "default" as const,
    fixed_weekday: null,
    fixed_service: null,
    only_weekday: null,
  })),
  {
    id: SALAD_STOCK_ID,
    name: "Ensalada según stock",
    primary_protein_id: null,
    services: ["salad"],
    restrictive_product_ids: [],
    active: true,
    source: "Regla operativa IPSP · ensaladas 2026-09-28",
    notes: "Solo para los días 6 y 7 del ciclo real contado desde el día posterior a la recepción de víveres.",
    base_ingredient: null,
    difficulty: 1,
    cooking_method: "Ensalada",
    double_fry: false,
    sunday_roast: false,
    base_qty_per_person: null,
    base_unit: null,
    protein_qty_per_person: null,
    protein_unit: null,
    rice_mode: "default",
    fixed_weekday: null,
    fixed_service: null,
    only_weekday: null,
  },
];

const INGREDIENTS_BY_RECIPE = new Map(SPECS.map((s) => [s.id, s.ingredients]));

export function saladIngredientKeys(recipeId: string | null | undefined): string[] {
  if (!recipeId || recipeId === SALAD_STOCK_ID) return [];
  return INGREDIENTS_BY_RECIPE.get(recipeId) ?? [];
}

function saladUsage(items: MenuItem[]) {
  const usage = new Map<string, number>();
  for (const item of items) {
    for (const key of saladIngredientKeys(item.salad_recipe_id)) {
      usage.set(key, (usage.get(key) ?? 0) + 1);
    }
  }
  return usage;
}

export function saladIngredientCapReason(items: MenuItem[], candidateId: string): string | null {
  const usage = saladUsage(items);
  for (const key of saladIngredientKeys(candidateId)) {
    const limit = SALAD_INGREDIENT_LIMITS[key];
    if (!limit) continue;
    const used = usage.get(key) ?? 0;
    if (used >= limit.max) return `${limit.label} ya aparece en ${used} ensalada(s); máximo semanal ${limit.max}.`;
  }
  return null;
}

export function saladIngredientViolations(items: MenuItem[]) {
  const usage = saladUsage(items);
  return [...usage.entries()]
    .map(([key, used]) => ({ key, used, limit: SALAD_INGREDIENT_LIMITS[key] }))
    .filter((x) => !!x.limit && x.used > x.limit.max)
    .map((x) => ({ key: x.key, label: x.limit.label, used: x.used, max: x.limit.max }));
}

export function saladTimingReason(recipeId: string, weekday: Weekday, arrival: Weekday): string | null {
  const pos = cyclePosition(weekday, arrival);
  if (pos >= 6 && recipeId !== SALAD_STOCK_ID)
    return "En los días 6 y 7 del ciclo solo corresponde Ensalada según stock.";
  if (pos <= 5 && recipeId === SALAD_STOCK_ID)
    return "Ensalada según stock se reserva únicamente para los días 6 y 7 del ciclo.";
  return null;
}

export function isFinalSalad(recipeId: string | null | undefined) {
  return !!recipeId && (recipeId === SALAD_STOCK_ID || INGREDIENTS_BY_RECIPE.has(recipeId));
}

export function finalSaladCatalog(catalog: Catalog) {
  return catalog.recipes.filter((r) => r.active && r.services.includes("salad") && isFinalSalad(r.id));
}
