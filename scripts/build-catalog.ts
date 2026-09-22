/**
 * Construye src/lib/seed/catalog.generated.ts a partir del maestro
 * MAESTRO_PLATOS_INGREDIENTES_IPSP.xlsx (exportado previamente a /tmp/master.json).
 *
 * - Productos restrictivos: ingredientes marcados como restrictivos y utilizables en menú.
 * - Ingredientes: lista maestra completa (referencia y validación).
 * - Preparaciones: 151 platos del maestro + los platos de los menús 37/38/39 que no están
 *   en el maestro + las ensaladas. Se hace deduplicación por nombre normalizado.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { RECIPES as LEGACY, historicalMenus } from "../src/lib/seed/legacy-source";
import type { Recipe, Service } from "../src/lib/types";

interface MasterPlato {
  id: string;
  original: string;
  name: string;
  protein: string;
  service: string;
  restrictive: string;
  parity: string;
  compatible: string;
  note: string | null;
  active: string;
}
interface MasterIng {
  id: string;
  group: string;
  name: string;
  restrictive: string;
  availability: string;
  useInMenu: string;
  note: string | null;
  active: string;
}

const master = JSON.parse(readFileSync("/tmp/master.json", "utf8")) as {
  platos: MasterPlato[];
  ingredientes: MasterIng[];
};

/* ------------------------- normalización ------------------------- */

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const slug = (s: string) =>
  norm(s).replace(/\s+/g, "-").slice(0, 58).replace(/^-|-$/g, "");

function similarity(a: string, b: string) {
  const A = norm(a).split(" ").filter(Boolean);
  const B = norm(b).split(" ").filter(Boolean);
  const setB = new Set(B);
  const common = A.filter((w) => setB.has(w)).length;
  return (2 * common) / (A.length + B.length);
}

/* ------------------------- ingredientes ------------------------- */

const ING_ID: Record<string, string> = {
  "AJI ORIENTAL": "aji",
  CANELA: "canela",
  COMINO: "comino",
  "PIMIENTA NEGRA MOLIDA": "pimienta-negra",
  "SAZONADOR LA SAZON": "sazonador-la-sazon",
  "COSTILLA DE RES": "costilla-res-prod",
  "PATA DE RES": "pata-res-prod",
  GARBANZO: "garbanzo",
  MOTE: "mote",
  QUAKER: "quaker",
  BROCOLI: "brocoli",
  COLIFLOR: "coliflor",
  PEPINO: "pepino",
  REMOLACHA: "remolacha",
  RABANO: "rabano",
  VERDURA: "verdura",
  "ATUN REAL": "atun-real",
  "FIDEO TALLARÍN": "tallarin",
  "FIDEOS VARIOS": "fideos",
  "SARDINA REAL": "sardina-prod",
};

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

const PRODUCT_NAME: Record<string, string> = {
  aji: "Ají",
  canela: "Canela",
  comino: "Comino",
  "pimienta-negra": "Pimienta negra molida",
  "sazonador-la-sazon": "Sazonador La Sazón",
  "costilla-res-prod": "Costilla de res",
  "pata-res-prod": "Pata de res",
  garbanzo: "Garbanzo",
  mote: "Mote",
  quaker: "Avena Quaker",
  brocoli: "Brócoli",
  coliflor: "Coliflor",
  pepino: "Pepino",
  remolacha: "Remolacha",
  rabano: "Rábano",
  verdura: "Verdura",
  "atun-real": "Atún Real",
  tallarin: "Fideo tallarín",
  fideos: "Fideos varios",
  "sardina-prod": "Sardina Real",
};

const products = master.ingredientes
  .filter((i) => i.restrictive === "Sí" && i.useInMenu === "Sí")
  .map((i) => {
    const id = ING_ID[i.name] ?? slug(i.name);
    return {
      id,
      name: PRODUCT_NAME[id] ?? titleCase(i.name),
      parity: i.availability === "Par" ? "par" : i.availability === "Impar" ? "impar" : "todas",
      category: titleCase(i.group),
      arrival_weekday: null as number | null,
      active: i.active === "Sí",
      notes: i.note,
    };
  });

/** Nombres con tildes y mayúsculas correctas (el maestro llega en mayúsculas sin tildes). */
const ING_NAME: Record<string, string> = {
  "AJI ORIENTAL": "Ají Oriental",
  MANI: "Maní",
  "SAZONADOR LA SAZON": "Sazonador La Sazón",
  "PIMIENTA NEGRA MOLIDA": "Pimienta negra molida",
  "COSTILLA DE RES": "Costilla de res",
  "PATA DE RES": "Pata de res",
  "HAMBURGUESAS DE RES": "Hamburguesas de res",
  "HUESO CARNUDO": "Hueso carnudo",
  "POLLO ENTERO": "Pollo entero",
  "JUGO EN POLVO YA": "Jugo en polvo YA",
  MARACUYA: "Maracuyá",
  "PULPA DE LIMON": "Pulpa de limón",
  "FREJOL BAYO BOLON": "Fréjol bayo bolón",
  "FREJOL PANAMITO": "Fréjol panamito",
  "LECHE LA VAQUITA": "Leche La Vaquita",
  "DETERGENTE DEJA": "Detergente Deja",
  FOSFOROS: "Fósforos",
  "JABON EL MACHO": "Jabón El Macho",
  "HAMBURGUESAS DE CAMARON": "Hamburguesas de camarón",
  QUAKER: "Avena Quaker",
  "AJOS PELADO": "Ajo pelado",
  BROCOLI: "Brócoli",
  "CILANTRO/HIERVITAS": "Cilantro / hierbitas",
  "FREJOL TIERNO": "Fréjol tierno",
  "OREGANO SECO": "Orégano seco",
  "PLATANOS VERDES": "Plátanos verdes",
  RABANO: "Rábano",
  "ACEITE LA FAVORITA": "Aceite La Favorita",
  "ACHIOTE FAVORITA": "Achiote Favorita",
  "ARROZ QQ": "Arroz (qq)",
  "ATUN REAL": "Atún Real",
  "AZUCAR SAN CARLOS": "Azúcar San Carlos",
  "CAFE DON CAFE": "Café Don Café",
  "FIDEO TALLARÍN": "Fideo tallarín",
  "FIDEOS VARIOS": "Fideos varios",
  "SARDINA REAL": "Sardina Real",
  "COCOA RICACAO": "Cocoa Ricacao",
  "FILETE CONG. 3-5 OZ (10X2LB)": "Filete congelado 3-5 oz (10x2 lb)",
  "SAL CRISAL": "Sal Crisal",
  "MANTECA 3 CHANCHITOS": "Manteca 3 Chanchitos",
  "MOSTAZA MAGGI": "Mostaza Maggi",
  "MAYONESA MAGGY": "Mayonesa Maggy",
  "CUBO MAGGY": "Cubo Maggy",
  "PASTA DE TOMATE LOS ANDES": "Pasta de tomate Los Andes",
  "SALSA DE TOMATE LOS ANDES": "Salsa de tomate Los Andes",
  "SALSA CHINA ORIENTAL": "Salsa china Oriental",
  "MARGARINA GIRASOL": "Margarina Girasol",
  "ESPONJA DE LAVAR PLATOS": "Esponja de lavar platos",
  "HARINA DE TRIGO": "Harina de trigo",
  "PULPA DE FRUTILLA": "Pulpa de frutilla",
  "PULPA DE NARANJILLA": "Pulpa de naranjilla",
  "PULPA DE PIÑA": "Pulpa de piña",
  "HABAS TIERNAS": "Habas tiernas",
  "CEBOLLA BLANCA": "Cebolla blanca",
  "CEBOLLA COLORADA": "Cebolla colorada",
};

const ingredients = master.ingredientes.map((i) => ({
  id: ING_ID[i.name] ?? slug(i.name),
  name: ING_NAME[i.name] ?? titleCase(i.name),
  group: titleCase(i.group),
  restrictive: i.restrictive === "Sí",
  availability: i.availability === "Par" ? "par" : i.availability === "Impar" ? "impar" : "todas",
  use_in_menu: i.useInMenu === "Sí",
  note: i.note,
}));

/* ------------------------- preparaciones ------------------------- */

const PROTEIN_ID: Record<string, string | null> = {
  Atún: "atun",
  Camarón: "camaron",
  "Carne molida de res": "carne-molida",
  Chorizo: "chorizo",
  "Chuleta de cerdo": "chuleta-cerdo",
  "Costilla de res": "costilla-res",
  "Cuero de cerdo": "cuero-cerdo",
  "Estofado de res": "estofado-res",
  Fritada: "fritada",
  "Hamburguesa de res": "hamburguesa-res",
  "Hueso carnudo de res": "hueso-carnudo",
  Huevo: "huevo",
  "Huevo + queso": "huevo",
  "Lomo de asado de cerdo": "lomo-cerdo",
  "Pata de res": "pata-res",
  Pollo: "pollo",
  Sardina: "sardina",
  "Sopa sin proteína animal específica": null,
  Tilapia: "tilapia",
};

const SERVICES: Record<string, Service[]> = {
  Desayuno: ["breakfast"],
  "Almuerzo / Cena": ["lunch", "dinner"],
  Sopa: ["soup"],
};

function restrictiveIds(text: string, name: string): string[] {
  if (!text || text === "Sin restricción detectada") return [];
  const ids = new Set<string>();
  for (const partRaw of text.split(",")) {
    const part = partRaw.trim();
    if (!part) continue;
    if (/fideo|pasta|tallar/i.test(part)) {
      ids.add(/tallar/i.test(name) ? "tallarin" : "fideos");
      continue;
    }
    if (/at[úu]n/i.test(part)) ids.add("atun-real");
    else if (/sardina/i.test(part)) ids.add("sardina-prod");
    else if (/costilla/i.test(part)) ids.add("costilla-res-prod");
    else if (/pata/i.test(part)) ids.add("pata-res-prod");
    else if (/verdura/i.test(part)) ids.add("verdura");
    else if (/quaker/i.test(part)) ids.add("quaker");
    else if (/rabano|rábano/i.test(part)) ids.add("rabano");
    else if (/remolacha/i.test(part)) ids.add("remolacha");
    else if (/garbanzo/i.test(part)) ids.add("garbanzo");
    else if (/mote/i.test(part)) ids.add("mote");
    else if (/canela/i.test(part)) ids.add("canela");
    else if (/aj[íi]/i.test(part)) ids.add("aji");
    else if (/brocoli|brócoli/i.test(part)) ids.add("brocoli");
    else if (/coliflor/i.test(part)) ids.add("coliflor");
    else if (/pepino/i.test(part)) ids.add("pepino");
  }
  return Array.from(ids);
}

/** Recetas heredadas (menús 37/38/39 y ensaladas) indexadas por nombre normalizado. */
const legacyByNorm = new Map(LEGACY.map((r) => [norm(r.name), r]));
const legacySalads = LEGACY.filter((r) => r.services.includes("salad"));
const legacyDishes = LEGACY.filter((r) => !r.services.includes("salad"));

const usedLegacy = new Set<string>();
const usedIds = new Set<string>();
const report: string[] = [];

function uniqueId(base: string) {
  let id = base || "plato";
  let n = 2;
  while (usedIds.has(id)) id = `${base}-${n++}`;
  usedIds.add(id);
  return id;
}

const masterRecipes: Recipe[] = master.platos.map((p) => {
  // Buscar la receta heredada equivalente para conservar su id (historial intacto).
  let match = legacyByNorm.get(norm(p.name));
  if (!match) {
    let best: { r: Recipe; score: number } | null = null;
    for (const r of legacyDishes) {
      if (usedLegacy.has(r.id)) continue;
      const score = similarity(p.name, r.name);
      if (!best || score > best.score) best = { r, score };
    }
    if (best && best.score >= 0.93) match = best.r;
  }
  if (match && usedLegacy.has(match.id)) match = undefined;
  if (match) {
    usedLegacy.add(match.id);
    report.push(`merge  ${match.name}  ←  ${p.name}`);
  }

  const proteinId = PROTEIN_ID[p.protein] ?? null;
  const services = SERVICES[p.service] ?? ["lunch", "dinner"];
  const active = p.active === "Sí";
  const notes =
    p.note ??
    (p.original !== p.name ? null : null);

  return {
    id: uniqueId(match?.id ?? slug(p.name)),
    name: p.name,
    primary_protein_id: proteinId,
    services,
    restrictive_product_ids: restrictiveIds(p.restrictive, p.name),
    active,
    source: "Maestro de platos IPSP",
    notes,
  } satisfies Recipe;
});

// Ids referenciados por los menús históricos: no pueden perderse
const referenced = new Set<string>();
for (const m of historicalMenus()) {
  for (const it of m.items) {
    if (it.recipe_id) referenced.add(it.recipe_id);
    if (it.salad_recipe_id) referenced.add(it.salad_recipe_id);
  }
}

// Platos históricos que el maestro no contiene.
// Se conservan los que provienen de los menús reales o que el historial referencia;
// los ejemplos abreviados del manual quedan cubiertos por el maestro.
const leftover = legacyDishes.filter(
  (r) =>
    !usedLegacy.has(r.id) &&
    (referenced.has(r.id) || r.source.startsWith("Menú semana") || r.source === "Duplicada")
);
const dropped = legacyDishes.filter(
  (r) => !usedLegacy.has(r.id) && !leftover.includes(r)
);
report.push("", `Ejemplos abreviados del manual descartados (cubiertos por el maestro): ${dropped.length}`);
dropped.forEach((r) => report.push(`  descarta  ${r.name}`));
report.push("", `Platos del maestro: ${masterRecipes.length}`);
report.push(`Fusionados con el histórico: ${usedLegacy.size}`);
report.push(`Platos históricos que el maestro no incluye: ${leftover.length}`);
leftover.forEach((r) => report.push(`  resto  ${r.name}  (${r.source})`));
report.push(`Ensaladas: ${legacySalads.length}`);

/* ------------------------- salida ------------------------- */

const ts = (v: unknown) => JSON.stringify(v);

const out = `/* ---------------------------------------------------------------------------
 * ARCHIVO GENERADO — no editar a mano.
 * Fuente: MAESTRO_PLATOS_INGREDIENTES_IPSP.xlsx  ·  npm run gen:catalog
 * --------------------------------------------------------------------------- */
import type { Recipe, RestrictiveProduct } from "../types";

export interface MasterIngredient {
  id: string;
  name: string;
  group: string;
  restrictive: boolean;
  availability: "todas" | "par" | "impar";
  use_in_menu: boolean;
  note: string | null;
}

/** Productos que condicionan cuándo puede utilizarse una preparación. */
export const PRODUCTS: RestrictiveProduct[] = ${ts(products)} as RestrictiveProduct[];

/** Lista maestra de ingredientes disponibles (referencia y validación). */
export const INGREDIENTS: MasterIngredient[] = ${ts(ingredients)} as MasterIngredient[];

/** Catálogo del maestro de platos. */
export const MASTER_RECIPES: Recipe[] = ${ts(masterRecipes)} as Recipe[];

/** Platos de los menús 37, 38 y 39 que el maestro no incluye. */
export const LEGACY_RECIPES: Recipe[] = ${ts(leftover)} as Recipe[];

/** Ensaladas utilizadas en almuerzos y cenas. */
export const SALAD_RECIPES: Recipe[] = ${ts(legacySalads)} as Recipe[];
`;

writeFileSync("src/lib/seed/catalog.generated.ts", out, "utf8");
writeFileSync("/tmp/catalog-report.txt", report.join("\n"), "utf8");
console.log(report.slice(-8).join("\n"));
console.log(
  `\ncatalog.generated.ts · ${products.length} productos · ${ingredients.length} ingredientes · ${masterRecipes.length} platos maestro · ${leftover.length} históricos · ${legacySalads.length} ensaladas`
);
