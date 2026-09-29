import type {
  Camp,
  Protein,
  Recipe,
  RestrictiveProduct,
  WeeklyMenu,
  Weekday,
  MenuItem,
  MainService,
} from "../types";
import {
  INGREDIENTS,
  LEGACY_RECIPES,
  MASTER_RECIPES as OLD_MASTER_RECIPES,
  SALAD_RECIPES,
} from "./catalog.generated";
import { MASTER_RECIPES_V2, PRODUCTS_V2 } from "./catalog.v2.generated";
import type { MasterIngredient } from "./catalog.generated";
import { FINAL_SALAD_RECIPES } from "../salads";

export type { MasterIngredient };

/**
 * Datos iniciales del sistema.
 * El catálogo de platos, los productos restrictivos y la lista maestra de
 * ingredientes provienen de MAESTRO_PLATOS_INGREDIENTES_IPSP.xlsx y se generan
 * con `npm run gen:catalog` en ./catalog.generated.ts.
 */

/** Productos restrictivos (maestro de ingredientes). */
export const PRODUCTS: RestrictiveProduct[] = PRODUCTS_V2;

/** Lista maestra de ingredientes disponibles. */
export const MASTER_INGREDIENTS: MasterIngredient[] = INGREDIENTS;

/** Catálogo completo: maestro + platos históricos no incluidos + ensaladas. */
const V2_IDS = new Set(MASTER_RECIPES_V2.map((r) => r.id));
const HISTORICAL_FALLBACK: Recipe[] = [...OLD_MASTER_RECIPES, ...LEGACY_RECIPES, ...SALAD_RECIPES]
  .filter((r) => !V2_IDS.has(r.id))
  .map((r) => ({ ...r, active: false, source: `${r.source} · histórico` }));

/** Solo el maestro final está activo para generar. Los IDs viejos y ensaladas históricas se conservan inactivos para leer historial. */
const LATEST_MASTER_RECIPES: Recipe[] = MASTER_RECIPES_V2.map((r) => {
  // Sardina: solo almuerzo, excepto Corviche de sardina, que también puede ser desayuno.
  if (r.primary_protein_id === "sardina") {
    return { ...r, services: r.id === "corviche-de-sardina" ? ["breakfast", "lunch"] : ["lunch"] };
  }
  // Atún y Huevo conservan sus preparaciones exclusivas de desayuno.
  if (r.primary_protein_id === "atun" || r.primary_protein_id === "huevo") return r;
  // De las preparaciones de chancho asociadas a Fritada, solo Estofado de chancho puede ir en desayuno.
  if (r.id === "estofado-de-chancho") {
    return { ...r, services: Array.from(new Set<Recipe["services"][number]>(["breakfast", ...r.services])) };
  }
  // Sopa/ensalada, doble fritura y platos fijos conservan exactamente su restricción de servicio.
  if (r.services.includes("soup") || r.services.includes("salad") || r.double_fry || r.fixed_service || r.only_weekday != null) return r;
  // Regla vigente: las demás proteínas generales pueden participar en desayuno,
  // excepto Fritada y Chuleta de cerdo.
  if (r.primary_protein_id && (r.services.includes("lunch") || r.services.includes("dinner"))) {
    if (r.primary_protein_id === "fritada" || r.primary_protein_id === "chuleta-cerdo") return r;
    return { ...r, services: Array.from(new Set<Recipe["services"][number]>(["breakfast", ...r.services])) };
  }
  return r;
});

export const RECIPES: Recipe[] = [...LATEST_MASTER_RECIPES, ...FINAL_SALAD_RECIPES, ...HISTORICAL_FALLBACK];

/* ============================ PROTEÍNAS ============================ */

export const PROTEINS: Protein[] = [
  p("fritada", "Fritada", "cerdo", 3, "per_person", 0.5, "libra", "½ libra por persona (congelada)"),
  p("hamburguesa-res", "Hamburguesa de res", "res", 1, "per_person", 1, "unidad", "1 hamburguesa por persona"),
  p("pollo", "Pollo", "pollo", 2, "per_group", 10, "pollo", "1 pollo = 10 porciones (pechuga 6 · 2 patas · 2 caderas)"),
  p("chorizo", "Chorizo", "cerdo", 2, "per_person", 1, "unidad", "1 chorizo por persona"),
  p("chuleta-cerdo", "Chuleta de cerdo", "cerdo", 2, "per_person", 1, "unidad", "1 chuleta por persona"),
  p("lomo-cerdo", "Lomo de cerdo", "cerdo", 1, "per_person", 0.5, "libra", "½ libra por persona"),
  p("estofado-res", "Estofado de res", "res", 1, "per_person", 0.5, "libra", "½ libra por persona"),
  p("carne-molida", "Carne molida de res", "res", 2, "per_group", 4, "libra", "1 libra para 4 personas"),
  p("cuero-cerdo", "Cuero de cerdo", "cerdo", 2, "per_group", 4, "libra", "1 libra para 4 personas"),
  p("tilapia", "Tilapia", "pescado", 2, "per_person", 1, "filete", "1 filete por persona"),
  p("hamburguesa-camaron", "Hamburguesa de camarón", "marisco", 1, "per_person", 1, "unidad", "1 unidad por persona"),
  p("camaron", "Camarón", "marisco", 1, "none", null, null, "Sin porción definida en el manual; máximo operativo 2 mientras no exista una porción de stock comparable"),
  {
    ...p("hueso-carnudo", "Hueso carnudo de res", "res", 2, "per_group", 3, "libra", "1 libra para 3 personas"),
    soup_only: true,
  },
  {
    ...p("costilla-res", "Costilla de res", "res", 1, "per_group", 4, "libra", "1 libra para 4 personas"),
    soup_only: true,
    parity: "par",
  },
  {
    ...p("pata-res", "Pata de res", "res", 1, "per_group", 4, "libra", "1 libra para 4 personas"),
    soup_only: true,
    parity: "impar",
  },
  {
    ...p("atun", "Atún", "pescado", 2, "per_person", 0.6, "lata", "6 latas por cada 10 personas"),
    breakfast_only: true,
    parity: "par",
  },
  {
    ...p("sardina", "Sardina", "pescado", 2, "per_person", 0.6, "lata", "6 latas por cada 10 personas"),
    breakfast_only: false,
    parity: "impar",
    notes: "Solo almuerzo; máximo efectivo además limitado por stock.",
  },
  {
    ...p("huevo", "Huevo", "huevo", 2, "per_person", 2, "huevo", "2 huevos por persona"),
    breakfast_only: true,
  },
];

function p(
  id: string,
  name: string,
  origin: Protein["origin"],
  target: number,
  portion_type: Protein["portion_type"],
  portion_value: number | null,
  portion_unit: string | null,
  portion_label: string
): Protein {
  return {
    id,
    name,
    origin,
    breakfast_only: false,
    soup_only: false,
    parity: "todas",
    target_frequency: target,
    portion_type,
    portion_value,
    portion_unit,
    portion_label,
    active: true,
    notes: null,
  };
}

/* ============================ CAMPAMENTOS ============================ */

export const CAMPS: Camp[] = [
  {
    id: "corvinero",
    name: "Corvinero",
    diners_default: 120,
    reception_weekday_default: 1,
    notes: "Recepción principal los martes.",
    active: true,
  },
  {
    id: "campamento-2",
    name: "Campamento 2",
    diners_default: 80,
    reception_weekday_default: 4,
    notes: "Recepción principal los viernes.",
    active: true,
  },
];

/* ======================= MENÚS HISTÓRICOS 37 · 38 · 39 ======================= */

type Row = [string | null, string | null, string | null];
/** [desayuno, almuerzo, cena] recetas por día + sopas + ensaladas */
interface HistWeek {
  year: number;
  week: number;
  camp: string;
  diners: number;
  arrival: Weekday;
  breakfastBeverage: string;
  mains: { breakfast: string[]; lunch: string[]; dinner: string[] };
  soups: (string | null)[];
  saladsLunch: (string | null)[];
  saladsDinner: (string | null)[];
}

const HIST: HistWeek[] = [
  {
    year: 2026,
    week: 37,
    camp: "corvinero",
    diners: 120,
    arrival: 1,
    breakfastBeverage: "Café / Chocolatada / Aromática / Quaker",
    mains: {
      breakfast: [
        "arroz-corviche-atun-ensalada",
        "arroz-bolon-verde-queso-huevo",
        "arroz-estofado-cerdo-desayuno",
        "arroz-cazuela-pescado",
        "encebollado-atun-arroz",
        "arroz-ensalada-sardina",
        "arroz-tigrillo-verde-queso-huevo",
      ],
      lunch: [
        "arroz-papas-rusticas-chuleta",
        "arroz-estofado-res",
        "arroz-amarillo-seco-pollo",
        "arroz-mote-fritada",
        "arroz-pescado-apanado",
        "pollo-brosterizado-papas-mayonesa",
        "arroz-pure-lomo-carbon",
      ],
      dinner: [
        "sango-verde-camaron",
        "arroz-cerdo-salsa-pina-verde",
        "tallarin-carne-res",
        "arroz-menestra-frejol-camaron-frito",
        "arroz-menestra-frejol-chuleta",
        "guatita-cuero-arroz",
        "llapingacho-chorizo",
      ],
    },
    soups: [
      "sancocho-hueso",
      "locro-habas",
      "menestron-frejol-hueso",
      "sopa-choclo",
      "caldo-pata",
      "caldo-lentejas-chorizo",
      "caldo-bola-verde-hamburguesa",
    ],
    saladsLunch: [
      "ens-tomate-cebolla-limon",
      null,
      "ens-rusa",
      "ens-tomate-cebolla-limon",
      "ens-rusa",
      "ens-fresca-tomate-pepino-cebolla",
      "ens-zanahoria-choclo-cebolla",
    ],
    saladsDinner: [
      null,
      "ens-pepino-zanahoria",
      "ens-tomate-cebolla-limon",
      "ens-rabano-cebolla-limon",
      "ens-fresca-tomate-pepino-cebolla",
      "ens-rusa",
      "ens-pepino-rabano-cebolla-limon",
    ],
  },
  {
    year: 2026,
    week: 38,
    camp: "corvinero",
    diners: 120,
    arrival: 1,
    breakfastBeverage: "Café / Chocolatada / Aromática / Quaker",
    mains: {
      breakfast: [
        "arroz-moro-tortilla-choclo-huevo",
        "arroz-sango-atun",
        "arroz-bistec-chancho-papas",
        "arroz-perico-huevo-queso",
        "arroz-frejol-hamburguesa-frita",
        "arroz-refritado-atun-verde",
        "arroz-tigrillo-bistec-res",
      ],
      lunch: [
        "arroz-relleno-chorizo-maduro",
        "arroz-pure-chuleta",
        "arroz-moro-bolitas-carne-fritas",
        "arroz-hamburguesa-camaron",
        "arroz-moro-chuleta",
        "arroz-papas-cuero",
        "arroz-pure-pollo-jugo",
      ],
      dinner: [
        "arroz-pescado-frito",
        "arroz-ceviche-camaron-chifles",
        "arroz-seco-cuero-mani",
        "arroz-seco-chancho",
        "arroz-sudado-pescado-patacones",
        "arroz-pasta-bolonesa",
        "arroz-cerdo-ajillo",
      ],
    },
    soups: [
      "caldo-torrejas-costilla",
      "sopa-avena-hueso",
      "sopa-choclo",
      "sopa-verduras-hueso",
      "locro-papa",
      "crema-legumbres",
      "sopa-frejol-panamito",
    ],
    saladsLunch: [
      "ens-remolacha-zanahoria-cebolla",
      "ens-coliflor-zanahoria-choclo",
      "ens-tomate-cebolla-limon",
      "ens-col-zanahoria",
      null,
      "ens-remolacha-tomate-cebolla",
      "ens-coliflor-tomate-cebolla",
    ],
    saladsDinner: [
      "ens-col-zanahoria-limon",
      null,
      "ens-tomate-cebolla-limon",
      "ens-remolacha-zanahoria",
      "ens-coliflor-tomate",
      "ens-tomate-choclo-cebolla",
      "ens-col-zanahoria",
    ],
  },
  {
    year: 2026,
    week: 39,
    camp: "corvinero",
    diners: 120,
    arrival: 1,
    breakfastBeverage: "Café / Chocolatada / Aromática",
    mains: {
      breakfast: [
        "arroz-picante-sardina",
        "arroz-menestra-carne-frita",
        "arroz-nabo-huevo-frito",
        "arroz-refritado-sardina",
        "arroz-maduro-lampreado-huevo",
        "arroz-frejol-hamburguesa-frita",
        "arroz-moro-frejol-chancho-frito",
      ],
      lunch: [
        "arroz-menestra-pollo-frito",
        "arroz-guiso-cuero-garbanzos",
        "arroz-pure-camaron-frito",
        "arroz-menestra-frejol-chuleta-asada",
        "arroz-hamburguesa-camaron",
        "arroz-menestra-pescado-frito",
        "arroz-chancho-frito",
      ],
      dinner: [
        "arroz-chaulafan-cerdo",
        "arroz-menestra-lenteja-chicharron-pescado",
        "arroz-papas-rusticas-chuleta",
        "arroz-moro-bolitas-carne-fritas",
        "arroz-moro-lenteja-cuero",
        "arroz-menestra-chorizo",
        "arroz-pollo-jugo",
      ],
    },
    soups: [
      "sopa-pata-bolitas-verde",
      "locro-habas",
      "sopa-tortitas-verde",
      "sopa-frejol-panamito",
      "caldo-hueso-lenteja",
      "menestron-lenteja-hueso",
      "sopa-lenteja",
    ],
    saladsLunch: [
      "ens-pepino-tomate-cebolla",
      "ens-rabano-pepino-cebolla",
      "ens-brocoli-zanahoria",
      "ens-tomate-cebolla",
      null,
      "ens-pepino-rabano-limon",
      "ens-brocoli-zanahoria-choclo",
    ],
    saladsDinner: [
      "ens-rabano-cebolla-limon",
      "ens-pepino-zanahoria",
      "ens-brocoli-tomate-cebolla",
      null,
      "ens-rabano-pepino-cebolla",
      "ens-tomate-cebolla",
      "ens-brocoli-zanahoria",
    ],
  },
];

function proteinOf(recipeId: string | null): string | null {
  if (!recipeId) return null;
  return RECIPES.find((x) => x.id === recipeId)?.primary_protein_id ?? null;
}

export function historicalMenus(): WeeklyMenu[] {
  return HIST.map((h) => {
    const items: MenuItem[] = [];
    for (let d = 0; d < 7; d++) {
      const wd = d as Weekday;
      const services: MainService[] = ["breakfast", "lunch", "dinner"];
      for (const service of services) {
        const recipeId = h.mains[service][d] ?? null;
        items.push({
          weekday: wd,
          service,
          component: "main",
          recipe_id: recipeId,
          protein_id: proteinOf(recipeId),
          salad_recipe_id:
            service === "lunch"
              ? h.saladsLunch[d] ?? null
              : service === "dinner"
              ? h.saladsDinner[d] ?? null
              : null,
          beverage:
            service === "breakfast"
              ? h.breakfastBeverage
              : service === "lunch"
              ? "Jugo de pulpa"
              : "Jugo de sobre",
          locked: false,
          reasons: [],
        });
      }
      const soupId = h.soups[d] ?? null;
      items.push({
        weekday: wd,
        service: "lunch",
        component: "soup",
        recipe_id: soupId,
        protein_id: proteinOf(soupId),
        salad_recipe_id: null,
        beverage: null,
        locked: false,
        reasons: [],
      });
    }
    return {
      id: `hist-${h.year}-${h.week}-${h.camp}`,
      year: h.year,
      week_number: h.week,
      parity: h.week % 2 === 0 ? "par" : "impar",
      camp_id: h.camp,
      diners: h.diners,
      supply_arrival_weekday: h.arrival,
      actual_start_date: null,
      actual_end_date: null,
      status: "utilizado",
      validation_score: 100,
      variety_score: 100,
      seed: null,
      notes: `Menú real cargado como historial inicial (semana ${h.week}).`,
      created_at: new Date(Date.UTC(h.year, 8, 1 + (h.week - 36))).toISOString(),
      items,
    } satisfies WeeklyMenu;
  });
}
