import type { Catalog, MenuItem, Recipe, Weekday } from "./types";
import { cycleDistance, cycleOrder } from "./rules";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export interface SoupComposition {
  pataOCostilla: number;
  hueso: number;
  crema: number;
  menestron: number;
  sinProteina: number;
}

export function soupTags(recipe: Recipe) {
  const text = normalize(recipe.name);
  return {
    pataOCostilla: recipe.primary_protein_id === "pata-res" || recipe.primary_protein_id === "costilla-res",
    hueso: recipe.primary_protein_id === "hueso-carnudo",
    crema: text.includes("crema"),
    menestron: text.includes("menestron"),
    sinProteina: !recipe.primary_protein_id,
  };
}

export function soupCompositionCounts(items: MenuItem[], catalog: Catalog): SoupComposition {
  const out: SoupComposition = { pataOCostilla: 0, hueso: 0, crema: 0, menestron: 0, sinProteina: 0 };
  for (const item of items) {
    if (item.component !== "soup" || !item.recipe_id) continue;
    const recipe = catalog.recipes.find((r) => r.id === item.recipe_id);
    if (!recipe) continue;
    const t = soupTags(recipe);
    if (t.pataOCostilla) out.pataOCostilla++;
    if (t.hueso) out.hueso++;
    if (t.crema) out.crema++;
    if (t.menestron) out.menestron++;
    if (t.sinProteina) out.sinProteina++;
  }
  return out;
}

export function soupCompositionSatisfied(items: MenuItem[], catalog: Catalog) {
  const x = soupCompositionCounts(items, catalog);
  return x.pataOCostilla >= 1 && x.hueso >= 2 && x.crema >= 1 && x.menestron >= 1 && x.sinProteina >= 1;
}

export function soupNeedScore(items: MenuItem[], recipe: Recipe, catalog: Catalog) {
  const x = soupCompositionCounts(items, catalog);
  const t = soupTags(recipe);
  let score = 0;
  if (x.pataOCostilla < 1 && t.pataOCostilla) score += 260;
  if (x.hueso < 2 && t.hueso) score += 230;
  if (x.crema < 1 && t.crema) score += 220;
  if (x.menestron < 1 && t.menestron) score += 220;
  if (x.sinProteina < 1 && t.sinProteina) score += 180;
  return score;
}

export function hasChickenOnFirstDay(items: MenuItem[], arrival: Weekday) {
  const firstDay = cycleOrder(arrival)[0];
  return items.some((i) => i.component === "main" && i.weekday === firstDay && i.protein_id === "pollo" && !!i.recipe_id);
}

export function sauceKey(recipe: Recipe): string | null {
  const text = normalize(recipe.name);
  if (text.includes("salsa de mostaza") || text.includes("a la mostaza") || text.includes("chancho a la mostaza")) return "mostaza";
  if (text.includes("salsa de pina")) return "piña";
  if (text.includes("al ajillo")) return "ajillo";
  if (text.includes("a la pimienta")) return "pimienta";
  if (text.includes("bbq")) return "bbq";
  if (text.includes("salsa de mani")) return "maní";
  if (text.includes("salsa de queso")) return "queso";
  if (text.includes("salsa bolonesa")) return "boloñesa";
  return null;
}

export function violatesAdjacentSauce(items: MenuItem[], weekday: Weekday, recipe: Recipe, catalog: Catalog, arrival: Weekday) {
  const key = sauceKey(recipe);
  if (!key) return false;
  return items.some((i) => {
    if (i.component !== "main" || !i.recipe_id) return false;
    const other = catalog.recipes.find((r) => r.id === i.recipe_id);
    if (!other || sauceKey(other) !== key) return false;
    return cycleDistance(i.weekday, weekday, arrival) <= 1;
  });
}

export function adjacentSauceViolations(items: MenuItem[], catalog: Catalog, arrival: Weekday) {
  const mains = items.filter((i) => i.component === "main" && !!i.recipe_id);
  const out: { label: string; dayA: Weekday; dayB: Weekday }[] = [];
  const seen = new Set<string>();
  for (let a = 0; a < mains.length; a++) {
    const ra = catalog.recipes.find((r) => r.id === mains[a].recipe_id);
    const keyA = ra ? sauceKey(ra) : null;
    if (!keyA) continue;
    for (let b = a + 1; b < mains.length; b++) {
      const rb = catalog.recipes.find((r) => r.id === mains[b].recipe_id);
      if (!rb || sauceKey(rb) !== keyA) continue;
      if (cycleDistance(mains[a].weekday, mains[b].weekday, arrival) > 1) continue;
      const dayA = mains[a].weekday;
      const dayB = mains[b].weekday;
      const sig = [keyA, Math.min(dayA, dayB), Math.max(dayA, dayB)].join("|");
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push({ label: `Salsa de ${keyA}`, dayA, dayB });
    }
  }
  return out;
}
