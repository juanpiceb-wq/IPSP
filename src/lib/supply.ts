import type { Recipe, SupplyLimit } from "./types";

/**
 * Capacidad semanal normalizada por persona, tomada del Cuadro de Víveres IPSP.
 * Solo aparecen insumos cuya unidad puede compararse de forma segura con el maestro.
 * Si una proteína/ingrediente no está aquí, el motor conserva máximos y reglas de catálogo,
 * pero no inventa una conversión de stock.
 */
export const SUPPLY_LIMITS: SupplyLimit[] = [
  { key: "protein:atun", label: "Atún Real", quantity_per_person: 1.2, unit: "LATA" },
  { key: "protein:huevo", label: "Huevos", quantity_per_person: 4, unit: "UN" },
  { key: "protein:sardina", label: "Sardina Real", quantity_per_person: 0.6, unit: "LATA" },
  { key: "protein:fritada", label: "Fritada", quantity_per_person: 1.25, unit: "LB", notes: "Maestro final: 125 lb/100 personas; máximo efectivo por stock = 2 servicios completos, aunque el máximo configurado siga siendo 3." },
  { key: "protein:hamburguesa-res", label: "Hamburguesa de res", quantity_per_person: 1, unit: "UN" },
  { key: "protein:chorizo", label: "Chorizo", quantity_per_person: 2.5, unit: "UN" },
  { key: "protein:pollo", label: "Pollo entero", quantity_per_person: 0.2, unit: "POLLO", notes: "Regla operativa vigente: capacidad semanal de hasta 2 servicios completos; el máximo configurado también es 2." },
  { key: "protein:hueso-carnudo", label: "Hueso carnudo", quantity_per_person: 0.42, unit: "LB" },
  { key: "protein:costilla-res", label: "Costilla de res", quantity_per_person: 0.25, unit: "LB", notes: "Maestro final: máximo efectivo 1 servicio; la hoja de abastecimiento mantiene una alerta de rendimiento 20 lb vs 25 lb teóricas." },
  { key: "protein:pata-res", label: "Pata de res", quantity_per_person: 0.25, unit: "LB", notes: "Maestro final: máximo efectivo 1 servicio; la hoja de abastecimiento mantiene una alerta de rendimiento 20 lb vs 25 lb teóricas." },
  { key: "meal:camaron", label: "Camarón / Hamburguesa de camarón", quantity_per_person: 1, unit: "SERVICIO", notes: "Hamburguesa de camarón y cualquier preparación de camarón comparten el mismo producto y solo alcanzan para 1 comida semanal." },
  { key: "protein:tilapia", label: "Filete de pescado", quantity_per_person: 0.2, unit: "LB", notes: "Reservado para ceviche dominical." },

  { key: "base:platano", label: "Plátano", quantity_per_person: 4, unit: "VERDE" },
  { key: "base:papa", label: "Papa", quantity_per_person: 2.1, unit: "LB" },
  { key: "base:pasta", label: "Pasta/fideo", quantity_per_person: 0.0967294838, unit: "LB" },
  { key: "base:yuca", label: "Yuca", quantity_per_person: 0.36, unit: "LB" },
  { key: "base:lenteja", label: "Lenteja", quantity_per_person: 0.2, unit: "LB" },
  { key: "base:garbanzo", label: "Garbanzo", quantity_per_person: 0.2, unit: "LB" },
  { key: "base:mote", label: "Mote", quantity_per_person: 0.2, unit: "LB" },
  { key: "base:frejol", label: "Fréjol / menestra", quantity_per_person: 0.2, unit: "LB" },
  { key: "base:choclo", label: "Choclo", quantity_per_person: 1, unit: "UN" },
  { key: "base:harina", label: "Harina de trigo", quantity_per_person: 0.2, unit: "LB" },
  { key: "base:remolacha", label: "Remolacha", quantity_per_person: 0.14, unit: "LB" },
];

const LIMIT_BY_KEY = new Map(SUPPLY_LIMITS.map((x) => [x.key, x]));

const BASE_KEY: Record<string, string> = {
  "Plátano verde": "base:platano",
  "Plátano maduro": "base:platano",
  Papa: "base:papa",
  "Pasta / fideo": "base:pasta",
  Yuca: "base:yuca",
  Lenteja: "base:lenteja",
  Garbanzo: "base:garbanzo",
  Mote: "base:mote",
  "Fréjol / menestra": "base:frejol",
  Choclo: "base:choclo",
  "Harina de trigo": "base:harina",
  Remolacha: "base:remolacha",
};

/**
 * Alias operativos de inventario. El catálogo puede llamar al mismo producto
 * de formas distintas, pero el stock debe descontarse de una sola bolsa.
 */
const SHRIMP_PROTEIN_IDS = new Set(["camaron", "hamburguesa-camaron"]);

export interface Consumption {
  key: string;
  label: string;
  quantity: number;
  unit: string;
}

function sameUnit(a: string | null | undefined, b: string) {
  if (!a) return false;
  const x = a.toUpperCase();
  const y = b.toUpperCase();
  if (x === y) return true;
  if ((x === "UN" || x === "UNIDAD") && y === "UN") return true;
  if (x === "LATA" && y === "LATA") return true;
  if (x === "POLLO" && y === "POLLO") return true;
  return false;
}

export function recipeConsumptions(recipe: Recipe, diners: number): Consumption[] {
  const out: Consumption[] = [];

  // Camarón y hamburguesa de camarón son el MISMO producto operativo.
  // Independientemente de cómo esté nombrada la preparación, todo uso consume
  // una de las únicas 1 comidas semanales disponibles de camarón.
  if (recipe.primary_protein_id && SHRIMP_PROTEIN_IDS.has(recipe.primary_protein_id)) {
    out.push({
      key: "meal:camaron",
      label: "Camarón / Hamburguesa de camarón",
      quantity: 1,
      unit: "SERVICIO",
    });
  }

  if (recipe.primary_protein_id && recipe.protein_qty_per_person && recipe.protein_unit) {
    const key = `protein:${recipe.primary_protein_id}`;
    const limit = LIMIT_BY_KEY.get(key);
    if (limit && sameUnit(recipe.protein_unit, limit.unit)) {
      out.push({ key, label: limit.label, quantity: recipe.protein_qty_per_person * diners, unit: limit.unit });
    }
  }

  if (recipe.base_ingredient && recipe.base_qty_per_person && recipe.base_unit) {
    const key = BASE_KEY[recipe.base_ingredient];
    const limit = key ? LIMIT_BY_KEY.get(key) : undefined;
    if (limit && sameUnit(recipe.base_unit, limit.unit)) {
      out.push({ key, label: limit.label, quantity: recipe.base_qty_per_person * diners, unit: limit.unit });
    }
  }

  return out;
}

export function availableQuantity(key: string, diners: number): number | null {
  const limit = LIMIT_BY_KEY.get(key);
  if (!limit) return null;
  // Límites expresados en SERVICIO son cuotas semanales absolutas, no se
  // multiplican por el número de comensales.
  if (limit.unit === "SERVICIO") return limit.quantity_per_person;
  return limit.quantity_per_person * diners;
}

export function canConsume(
  ledger: Map<string, number>,
  recipe: Recipe,
  diners: number
): string | null {
  for (const c of recipeConsumptions(recipe, diners)) {
    const cap = availableQuantity(c.key, diners);
    if (cap == null) continue;
    const used = ledger.get(c.key) ?? 0;
    if (used + c.quantity > cap + 1e-9) {
      return `${c.label}: el plato requeriría ${round(used + c.quantity)} ${c.unit} y el stock semanal permite ${round(cap)} ${c.unit}.`;
    }
  }
  return null;
}

export function addConsumption(ledger: Map<string, number>, recipe: Recipe, diners: number) {
  for (const c of recipeConsumptions(recipe, diners)) {
    ledger.set(c.key, (ledger.get(c.key) ?? 0) + c.quantity);
  }
}

export function buildLedger(recipes: Recipe[], diners: number): Map<string, number> {
  const ledger = new Map<string, number>();
  for (const r of recipes) addConsumption(ledger, r, diners);
  return ledger;
}

export function inventorySummary(ledger: Map<string, number>, diners: number) {
  return SUPPLY_LIMITS.map((l) => {
    const cap = l.unit === "SERVICIO" ? l.quantity_per_person : l.quantity_per_person * diners;
    const used = ledger.get(l.key) ?? 0;
    return { ...l, cap, used, pct: cap > 0 ? Math.round((used / cap) * 100) : 0 };
  }).filter((x) => x.used > 0);
}

function round(v: number) {
  return Math.round(v * 100) / 100;
}
