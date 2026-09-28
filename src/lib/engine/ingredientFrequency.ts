import type { Catalog, MainService, MenuItem, Recipe, Weekday } from "../types";
import { RULES } from "../rules";

export interface IngredientCapViolation {
  key: string;
  label: string;
  services: number;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicalIngredient(label: string): { key: string; label: string } | null {
  const n = normalize(label);
  if (!n || n === "sin base dominante" || n === "arroz" || n === "arroz especial") return null;
  if (n.includes("platano")) return { key: "platano", label: "Plátano" };
  if (n.includes("fideo") || n.includes("tallarin") || n.includes("pasta"))
    return { key: "pasta", label: "Pasta / fideo / tallarín" };
  return { key: n, label };
}

export function controlledIngredientKeys(recipe: Recipe, catalog: Catalog) {
  const out = new Map<string, string>();
  if (recipe.base_ingredient) {
    const base = canonicalIngredient(recipe.base_ingredient);
    if (base) out.set(base.key, base.label);
  }
  for (const productId of recipe.restrictive_product_ids) {
    const label = catalog.products.find((p) => p.id === productId)?.name ?? productId;
    const item = canonicalIngredient(label);
    if (item) out.set(item.key, item.label);
  }
  return [...out.entries()].map(([key, label]) => ({ key, label }));
}

function collectUsage(items: MenuItem[], catalog: Catalog) {
  const usage = new Map<string, { label: string; slots: Set<string> }>();
  for (const item of items) {
    if (!item.recipe_id) continue;
    const recipe = catalog.recipes.find((r) => r.id === item.recipe_id);
    if (!recipe) continue;
    const slot = `${item.weekday}|${item.service}`;
    for (const ingredient of controlledIngredientKeys(recipe, catalog)) {
      const row = usage.get(ingredient.key) ?? { label: ingredient.label, slots: new Set<string>() };
      row.slots.add(slot);
      usage.set(ingredient.key, row);
    }
  }
  return usage;
}

export function weeklyIngredientCapReason(
  items: MenuItem[],
  recipe: Recipe,
  weekday: Weekday,
  service: MainService,
  catalog: Catalog
): string | null {
  const usage = collectUsage(items, catalog);
  const targetSlot = `${weekday}|${service}`;
  for (const ingredient of controlledIngredientKeys(recipe, catalog)) {
    const row = usage.get(ingredient.key);
    const services = row?.slots.size ?? 0;
    const alreadyInThisService = row?.slots.has(targetSlot) ?? false;
    if (!alreadyInThisService && services >= RULES.MAX_INGREDIENT_SERVICES_PER_WEEK)
      return `${ingredient.label} ya aparece en ${services} servicios esta semana; máximo ${RULES.MAX_INGREDIENT_SERVICES_PER_WEEK}.`;
  }
  return null;
}

export function weeklyIngredientCapViolations(items: MenuItem[], catalog: Catalog): IngredientCapViolation[] {
  const usage = collectUsage(items, catalog);
  return [...usage.entries()]
    .filter(([, row]) => row.slots.size > RULES.MAX_INGREDIENT_SERVICES_PER_WEEK)
    .map(([key, row]) => ({ key, label: row.label, services: row.slots.size }))
    .sort((a, b) => b.services - a.services || a.label.localeCompare(b.label, "es"));
}
