/** Prueba del motor sin interfaz: genera varias semanas y muestra la validación. */
import { CAMPS, MASTER_INGREDIENTS, PRODUCTS, PROTEINS, RECIPES, historicalMenus } from "../src/lib/seed/data";
import { generateMenu } from "../src/lib/engine/generate";
import { validateMenu } from "../src/lib/engine/validate";
import { parityOfWeek } from "../src/lib/rules";
import type { Catalog, WeeklyMenu } from "../src/lib/types";

const catalog: Catalog = {
  proteins: PROTEINS,
  products: PRODUCTS,
  recipes: RECIPES,
  camps: CAMPS,
  zones: [],
  ingredients: MASTER_INGREDIENTS,
};

let history: WeeklyMenu[] = historicalMenus();

for (const week of [40, 41, 42, 43]) {
  const parity = parityOfWeek(week);
  const gen = generateMenu({
    year: 2026,
    week,
    parity,
    campId: "corvinero",
    diners: 120,
    arrival: 1,
    catalog,
    history,
  });
  const v = validateMenu({
    items: gen.items,
    catalog,
    parity,
    arrival: 1,
    year: 2026,
    week,
    campId: "corvinero",
    diners: 120,
    history,
  });

  const errors = v.issues.filter((i) => i.level === "error");
  const warns = v.issues.filter((i) => i.level === "warn");
  console.log(
    `\n=== Semana ${week} (${parity}) · platos ${v.metrics.mainCount}/21 · sopas ${v.metrics.soupCount}/6 · ensaladas ${v.metrics.saladCount}/14 · variedad ${v.metrics.varietyScore}% ===`
  );
  errors.forEach((e) => console.log("  ERROR :", e.message));
  warns.forEach((w) => console.log("  aviso :", w.message));
  if (errors.length === 0) console.log("  Sin errores críticos ✓");

  history = [
    ...history,
    {
      id: `sim-${week}`,
      year: 2026,
      week_number: week,
      parity,
      camp_id: "corvinero",
      diners: 120,
      supply_arrival_weekday: 1,
      actual_start_date: null,
      actual_end_date: null,
      status: "utilizado",
      validation_score: v.metrics.complianceScore,
      variety_score: v.metrics.varietyScore,
      seed: gen.seed,
      notes: null,
      created_at: new Date().toISOString(),
      items: gen.items,
    },
  ];
}
