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
  /** Máximo de platos (fuertes + sopas) repetidos respecto de la semana anterior; el ceviche dominical fijo no cuenta. */
  MAX_REPEATS_PREVIOUS_WEEK: 5,
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

/**
 * Distancia mínima entre dos días dentro del ciclo semanal circular.
 * Es la única fuente de verdad para reglas temporales que cruzan el cierre/inicio
 * del ciclo de recepción. El mismo día tiene distancia 0 y días contiguos 1.
 */
export function cycleDistance(dayA: Weekday, dayB: Weekday, arrival: Weekday): number {
  const direct = Math.abs(cyclePosition(dayA, arrival) - cyclePosition(dayB, arrival));
  return Math.min(direct, 7 - direct);
}

/**
 * Proyecta un weekday del menú maestro (recepción `source`) al calendario de otra recepción.
 * El domingo siempre queda en domingo. Los otros seis días conservan el orden del ciclo del
 * maestro y solo se recorren para dejar libre la posición del domingo en la recepción destino.
 * Ej.: maestro con recepción martes (Día 1..4, domingo, Día 6, Día 7) proyectado a recepción
 * jueves queda vie=Día 1, sáb=Día 2, dom=domingo, lun=Día 3, mar=Día 4, mié=Día 6, jue=Día 7.
 * Entre martes y miércoles el resultado es el mismo que intercambiar el bloque del domingo,
 * porque ahí el domingo solo se mueve una posición. El resultado no depende de qué
 * campamento sirve de maestro.
 */
export function projectWeekday(day: Weekday, source: Weekday, target: Weekday): Weekday {
  if (source === target || day === 6) return day;
  const sourcePos = cyclePosition(day, source);
  const sourceSunday = cyclePosition(6, source);
  const targetSunday = cyclePosition(6, target);
  const rank = sourcePos < sourceSunday ? sourcePos : sourcePos - 1;
  const targetPos = rank < targetSunday ? rank : rank + 1;
  return (((target + targetPos) % 7) as Weekday);
}

/**
 * Distancia mínima entre dos días del menú maestro considerando TODAS las recepciones
 * activas que comparten ese menú. Dos días que quedan contiguos en cualquier campamento
 * se tratan como contiguos.
 */
export function sharedCycleDistance(dayA: Weekday, dayB: Weekday, base: Weekday, arrivals: readonly Weekday[] = []): number {
  let distance = cycleDistance(dayA, dayB, base);
  for (const target of arrivals) {
    if (target === base) continue;
    distance = Math.min(distance, cycleDistance(projectWeekday(dayA, base, target), projectWeekday(dayB, base, target), target));
  }
  return distance;
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
