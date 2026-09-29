import type { MainService, Parity, Weekday } from "./types";

export const RULES = {
  MAIN_SLOTS: 21,
  SOUP_SLOTS: 6,
  SALAD_SERVICES: 14,
  SALAD_MIN: 5,
  SALAD_TARGET: 5,
  PORK_EXCEPTIONS_ALLOWED: 1,
  HISTORY_WEEKS: 8,
  MAX_DAILY_DIFFICULTY: 6,
  GREEN_PLANTAIN_DAYS: 4,
  MIN_PROTEIN_GAP_DAYS: 1,
  MAX_INGREDIENT_SERVICES_PER_WEEK: 4,
} as const;

export const SOUP_ONLY_HINT = ["hueso-carnudo", "costilla-res", "pata-res"];
/** Atún y Huevo son exclusivos de desayuno. Las demás proteínas generales pueden aparecer en desayuno. Sardina es exclusiva de almuerzo, salvo Corviche de sardina. */
export const BREAKFAST_ONLY_HINT = ["huevo", "atun"];
export const LUNCH_ONLY_HINT = ["sardina"];

export const STATIC_BEVERAGE_LABELS: Record<MainService, string> = {
  breakfast: "Café / Chocolatada / Quaker / Aromática",
  lunch: "Jugo de Pulpa / Quaker",
  dinner: "Jugo en Polvo / Café",
};

const ODD_WEEK_BEVERAGE_LABELS: Record<MainService, string> = {
  breakfast: "Café / Chocolatada / Aromática",
  lunch: "Jugo de Pulpa",
  dinner: "Jugo en Polvo / Café",
};

/** Las bebidas son estáticas por servicio. Quaker solo está disponible en semana par. */
export function beverageLabel(service: MainService, parity: Parity): string {
  return parity === "par" ? STATIC_BEVERAGE_LABELS[service] : ODD_WEEK_BEVERAGE_LABELS[service];
}

export function allowedBeverages(service: MainService, parity: Parity): string[] {
  return [beverageLabel(service, parity)];
}

export function parityOfWeek(week: number): Parity {
  return week % 2 === 0 ? "par" : "impar";
}

/**
 * Posición de un día dentro del ciclo real de uso.
 * El ciclo empieza el día siguiente a la recepción de víveres.
 * Ej.: recepción martes → miércoles = 1 … martes siguiente = 7.
 */
export function cyclePosition(weekday: Weekday, arrival: Weekday): number {
  return (((weekday - arrival - 1 + 7) % 7) + 1);
}

export function firstUsablePosition(productArrival: Weekday, arrival: Weekday): number {
  return cyclePosition(productArrival, arrival) + 1 > 7
    ? 1
    : cyclePosition(productArrival, arrival) + 1;
}

export function cycleOrder(arrival: Weekday): Weekday[] {
  const out: Weekday[] = [];
  for (let i = 1; i <= 7; i++) out.push((((arrival + i) % 7) as Weekday));
  return out;
}

export const SUNDAY_PREFERRED_PROTEINS = ["pollo", "lomo-cerdo", "estofado-res"];




