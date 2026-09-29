import type { Catalog, MainService, MenuItem, Recipe, Weekday } from "../types";

export interface IngredientCapViolation {
  key: string;
  label: string;
  services: number;
}

/**
 * El maestro revisado 2026-09-29 aclara que ingredientes de refrito y acompañamiento
 * (tomate, cebolla, pimiento, cilantro, etc.) se reparten entre muchos platos.
 * Por eso NO existe un máximo duro general de apariciones para platos fuertes.
 * Stock, paridad, maduración, base dominante y reglas específicas siguen vigentes.
 */
export function weeklyIngredientCapReason(
  _items: MenuItem[],
  _recipe: Recipe,
  _weekday: Weekday,
  _service: MainService,
  _catalog: Catalog
): string | null {
  return null;
}

export function weeklyIngredientCapViolations(
  _items: MenuItem[],
  _catalog: Catalog
): IngredientCapViolation[] {
  return [];
}
