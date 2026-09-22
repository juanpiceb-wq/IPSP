import type {
  Camp,
  Protein,
  Recipe,
  RestrictiveProduct,
  Service,
  WeeklyMenu,
  Weekday,
  MenuItem,
  MainService,
} from "../types";

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
  p("camaron", "Camarón", "marisco", 1, "none", null, null, "Sin porción definida en el manual"),
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
    breakfast_only: true,
    parity: "impar",
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

/* ====================== PRODUCTOS RESTRICTIVOS ====================== */

export const PRODUCTS: RestrictiveProduct[] = [
  rp("costilla-res-prod", "Costilla de res", "par", "Proteína"),
  rp("canela", "Canela", "par", "Condimento"),
  rp("comino", "Comino", "par", "Condimento"),
  rp("aji", "Ají", "par", "Condimento"),
  rp("sazonador-la-sazon", "Sazonador La Sazón", "par", "Condimento"),
  rp("pimienta-negra", "Pimienta negra molida", "par", "Condimento"),
  rp("quaker", "Avena Quaker", "par", "Bebida / grano"),
  rp("coliflor", "Coliflor", "par", "Vegetal"),
  rp("verdura", "Verdura", "par", "Vegetal"),
  rp("remolacha", "Remolacha", "par", "Vegetal"),
  rp("atun-real", "Atún Real", "par", "Enlatado"),
  rp("fideos", "Fideos", "par", "Pasta"),
  rp("tallarin", "Tallarín", "par", "Pasta"),
  rp("pata-res-prod", "Pata de res", "impar", "Proteína"),
  rp("garbanzo", "Garbanzo", "impar", "Grano"),
  rp("mote", "Mote", "impar", "Grano"),
  rp("brocoli", "Brócoli", "impar", "Vegetal"),
  rp("pepino", "Pepino", "impar", "Vegetal"),
  rp("rabano", "Rábano", "impar", "Vegetal"),
  rp("sardina-prod", "Sardina", "impar", "Enlatado"),
];

function rp(
  id: string,
  name: string,
  parity: RestrictiveProduct["parity"],
  category: string
): RestrictiveProduct {
  return { id, name, parity, category, arrival_weekday: null, active: true, notes: null };
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

/* ============================ PREPARACIONES ============================ */

const B: Service[] = ["breakfast"];
const LD: Service[] = ["lunch", "dinner"];
const BLD: Service[] = ["breakfast", "lunch", "dinner"];
const SOUP: Service[] = ["soup"];
const SAL: Service[] = ["salad"];

const CAT = "Catálogo inicial";
const M37 = "Menú semana 37";
const M38 = "Menú semana 38";
const M39 = "Menú semana 39";

function r(
  id: string,
  name: string,
  protein: string | null,
  services: Service[],
  restrictive: string[] = [],
  source: string = CAT,
  extra: Partial<Recipe> = {}
): Recipe {
  return {
    id,
    name,
    primary_protein_id: protein,
    services,
    restrictive_product_ids: restrictive,
    active: true,
    source,
    notes: null,
    ...extra,
  };
}

export const RECIPES: Recipe[] = [
  /* ---------- DESAYUNO · ATÚN (solo desayuno · semana par) ---------- */
  r("refrito-atun", "Refrito de atún", "atun", B, ["atun-real"]),
  r("sango-atun", "Sango de atún", "atun", B, ["atun-real"]),
  r("corviche-atun", "Corviche de atún", "atun", B, ["atun-real"]),
  r("encebollado-atun", "Encebollado de atún", "atun", B, ["atun-real"]),
  r("picante-atun", "Picante de atún", "atun", B, ["atun-real"]),
  r("ensalada-atun", "Ensalada de atún", "atun", B, ["atun-real"]),
  r("arroz-corviche-atun-ensalada", "Arroz, corviche de atún y ensalada", "atun", B, ["atun-real"], M37),
  r("encebollado-atun-arroz", "Encebollado de atún acompañado de arroz", "atun", B, ["atun-real"], M37),
  r("arroz-sango-atun", "Arroz con sango de atún", "atun", B, ["atun-real"], M38),
  r("arroz-refritado-atun-verde", "Arroz con refritado de atún y verde frito", "atun", B, ["atun-real"], M38),

  /* ---------- DESAYUNO · SARDINA (solo desayuno · semana impar) ---------- */
  r("refrito-sardina", "Refrito de sardina", "sardina", B, ["sardina-prod"]),
  r("ensalada-sardina", "Ensalada de sardina", "sardina", B, ["sardina-prod"]),
  r("picante-sardina", "Picante de sardina", "sardina", B, ["sardina-prod"]),
  r("arroz-ensalada-sardina", "Arroz, ensalada y sardina", "sardina", B, ["sardina-prod"], M37),
  r("arroz-picante-sardina", "Arroz con picante de sardina", "sardina", B, ["sardina-prod"], M39),
  r("arroz-refritado-sardina", "Arroz con refritado de sardina", "sardina", B, ["sardina-prod"], M39),

  /* ---------- DESAYUNO · HUEVO (solo desayuno) ---------- */
  r("bolon-huevo-frito", "Bolón con huevo frito", "huevo", B),
  r("tigrillo-huevo", "Tigrillo con huevo", "huevo", B),
  r("huevo-revuelto", "Huevo revuelto", "huevo", B),
  r("tortilla-huevo", "Tortilla de huevo", "huevo", B),
  r("perico-huevo-queso", "Perico de huevo con queso", "huevo", B),
  r("arroz-bolon-verde-queso-huevo", "Arroz y bolón de verde con queso, acompañado de huevo frito", "huevo", B, [], M37),
  r("arroz-tigrillo-verde-queso-huevo", "Arroz, tigrillo de verde con queso y huevo frito", "huevo", B, [], M37),
  r("arroz-moro-tortilla-choclo-huevo", "Arroz moro con tortilla de choclo y huevo frito", "huevo", B, [], M38),
  r("arroz-perico-huevo-queso", "Arroz con perico de huevo y queso", "huevo", B, [], M38),
  r("arroz-nabo-huevo-frito", "Arroz con nabo y huevo frito", "huevo", B, [], M39),
  r("arroz-maduro-lampreado-huevo", "Arroz, maduro lampreado y huevo frito", "huevo", B, [], M39),

  /* ---------- CERDO · FRITADA ---------- */
  r("chancho-horneado", "Chancho horneado", "fritada", LD),
  r("seco-chancho", "Seco de chancho", "fritada", LD),
  r("estofado-chancho", "Estofado de chancho", "fritada", BLD),
  r("fritada-mote", "Fritada con mote", "fritada", LD, ["mote"]),
  r("cerdo-ajillo", "Cerdo al ajillo", "fritada", LD),
  r("cerdo-salsa-pina", "Cerdo en salsa de piña", "fritada", LD),
  r("arroz-estofado-cerdo-desayuno", "Arroz con estofado de cerdo", "fritada", BLD, [], M37),
  r("arroz-mote-fritada", "Arroz, mote y fritada de cerdo", "fritada", LD, ["mote"], M37),
  r("arroz-cerdo-salsa-pina-verde", "Arroz con cerdo en salsa de piña y verde frito", "fritada", LD, [], M37),
  r("arroz-seco-chancho", "Arroz con seco de chancho", "fritada", LD, [], M38),
  r("arroz-cerdo-ajillo", "Arroz con cerdo al ajillo", "fritada", LD, [], M38),
  r("arroz-chancho-frito", "Arroz con chancho frito", "fritada", LD, [], M39),
  r("arroz-chaulafan-cerdo", "Arroz tipo chaulafán con cerdo", "fritada", LD, [], M39),

  /* ---------- CERDO · LOMO ---------- */
  r("bistec-chancho", "Bistec de chancho", "lomo-cerdo", BLD),
  r("carne-cerdo-plancha", "Carne de cerdo a la plancha", "lomo-cerdo", LD),
  r("chancho-mostaza", "Chancho a la mostaza", "lomo-cerdo", LD),
  r("lomo-salteado", "Lomo salteado", "lomo-cerdo", LD),
  r("cerdo-apanado", "Cerdo apanado", "lomo-cerdo", LD),
  r("arroz-pure-lomo-carbon", "Arroz con puré y lomo de cerdo al carbón", "lomo-cerdo", LD, [], M37),
  r("arroz-bistec-chancho-papas", "Arroz con bistec de chancho y papas fritas", "lomo-cerdo", BLD, [], M38),
  r("arroz-moro-frejol-chancho-frito", "Arroz con moro de fréjol tierno y carne de chancho frita", "lomo-cerdo", BLD, [], M39),

  /* ---------- CERDO · CHULETA ---------- */
  r("arroz-pure-chuleta", "Arroz con puré de papa y chuleta de cerdo", "chuleta-cerdo", LD),
  r("arroz-moro-chuleta", "Arroz moro con chuleta de cerdo", "chuleta-cerdo", LD),
  r("arroz-papas-rusticas-chuleta", "Arroz con papas rústicas y chuleta de cerdo", "chuleta-cerdo", LD),
  r("arroz-menestra-chuleta", "Arroz con menestra y chuleta de cerdo", "chuleta-cerdo", LD),
  r("arroz-menestra-frejol-chuleta", "Arroz con menestra de fréjol y chuleta de cerdo", "chuleta-cerdo", LD, [], M37),
  r("arroz-menestra-frejol-chuleta-asada", "Arroz con menestra de fréjol y chuleta asada", "chuleta-cerdo", LD, [], M39),

  /* ---------- CERDO · CHORIZO ---------- */
  r("yapingacho-chorizo", "Yapingacho con chorizo", "chorizo", LD),
  r("arroz-menestra-chorizo", "Arroz con menestra y chorizo", "chorizo", LD),
  r("arroz-pure-chorizo", "Arroz con puré y chorizo", "chorizo", LD),
  r("arroz-relleno-chorizo-maduro", "Arroz relleno de chorizo con tajadas de maduro", "chorizo", LD, [], M38),
  r("llapingacho-chorizo", "Llapingacho: tortillas de papa con queso, arroz y chorizo", "chorizo", LD, [], M37),

  /* ---------- CERDO · CUERO ---------- */
  r("seco-cuero", "Seco de cuero", "cuero-cerdo", LD),
  r("guiso-cuero-garbanzos", "Guiso de cuero con garbanzos", "cuero-cerdo", LD, ["garbanzo"]),
  r("seco-cuero-mani", "Seco de cuero con maní", "cuero-cerdo", LD),
  r("ceviche-cuero", "Ceviche de cuero", "cuero-cerdo", LD),
  r("guatita-cuero", "Guatita de cuero", "cuero-cerdo", LD),
  r("guatita-cuero-arroz", "Guatita de cuero de cerdo con arroz", "cuero-cerdo", LD, [], M37),
  r("arroz-papas-cuero", "Arroz con papas y cuero de cerdo", "cuero-cerdo", LD, [], M38),
  r("arroz-seco-cuero-mani", "Arroz con seco de cuero de cerdo y maní", "cuero-cerdo", LD, [], M38),
  r("arroz-guiso-cuero-garbanzos", "Arroz con guiso de cuero de cerdo y garbanzos", "cuero-cerdo", LD, ["garbanzo"], M39),
  r("arroz-moro-lenteja-cuero", "Arroz moro de lenteja con cuero de cerdo", "cuero-cerdo", LD, [], M39),

  /* ---------- RES · ESTOFADO ---------- */
  r("bistec-res", "Bistec de res", "estofado-res", BLD),
  r("carne-frita", "Carne frita", "estofado-res", BLD),
  r("seco-res", "Seco de res", "estofado-res", LD),
  r("estofado-res-plato", "Estofado de res", "estofado-res", LD),
  r("arroz-estofado-res", "Arroz con estofado de res", "estofado-res", LD, [], M37),
  r("arroz-tigrillo-bistec-res", "Arroz con tigrillo de verde y bistec de res", "estofado-res", B, [], M38),
  r("arroz-menestra-carne-frita", "Arroz con menestra y carne frita", "estofado-res", BLD, [], M39),

  /* ---------- RES · CARNE MOLIDA ---------- */
  r("arroz-moro-bolitas-carne", "Arroz moro con bolitas de carne", "carne-molida", LD),
  r("carne-bolonesa", "Carne a la boloñesa", "carne-molida", LD, ["fideos"]),
  r("tallarin-carne", "Tallarín con carne", "carne-molida", LD, ["tallarin"]),
  r("tallarin-carne-res", "Tallarín con carne de res", "carne-molida", LD, ["tallarin"], M37),
  r("arroz-moro-bolitas-carne-fritas", "Arroz moro con bolitas de carne fritas", "carne-molida", LD, [], M38),
  r("arroz-pasta-bolonesa", "Arroz con pasta de carne a la boloñesa", "carne-molida", LD, ["fideos"], M38),

  /* ---------- RES · HAMBURGUESA ---------- */
  r("arroz-frejol-hamburguesa-frita", "Arroz con fréjol y hamburguesa frita", "hamburguesa-res", BLD, [], M38),

  /* ---------- POLLO ---------- */
  r("pollo-frito", "Pollo frito", "pollo", LD),
  r("seco-pollo", "Seco de pollo", "pollo", LD),
  r("arroz-con-pollo", "Arroz con pollo", "pollo", LD),
  r("pollo-jugo", "Pollo al jugo", "pollo", LD),
  r("pollo-brosterizado", "Pollo brosterizado", "pollo", LD),
  r("arroz-amarillo-seco-pollo", "Arroz amarillo con seco de pollo", "pollo", LD, [], M37),
  r("pollo-brosterizado-papas-mayonesa", "Pollo brosterizado con arroz, papas fritas y mayonesa casera", "pollo", LD, [], M37),
  r("arroz-pure-pollo-jugo", "Arroz con puré de papa y pollo al jugo", "pollo", LD, [], M38),
  r("arroz-menestra-pollo-frito", "Arroz con menestra y pollo frito", "pollo", LD, [], M39),
  r("arroz-pollo-jugo", "Arroz con pollo al jugo", "pollo", LD, [], M39),

  /* ---------- PESCADO · TILAPIA ---------- */
  r("pescado-frito", "Pescado frito", "tilapia", LD),
  r("sudado-pescado", "Sudado de pescado", "tilapia", LD),
  r("chicharron-pescado", "Chicharrón de pescado", "tilapia", LD),
  r("pescado-apanado", "Pescado apanado", "tilapia", LD),
  r("cazuela-pescado", "Cazuela de pescado", "tilapia", BLD),
  r("arroz-cazuela-pescado", "Arroz con cazuela de pescado", "tilapia", B, [], M37),
  r("arroz-pescado-apanado", "Arroz con pescado apanado", "tilapia", LD, [], M37),
  r("arroz-pescado-frito", "Arroz con pescado frito", "tilapia", LD, [], M38),
  r("arroz-sudado-pescado-patacones", "Arroz con sudado de pescado y patacones", "tilapia", LD, [], M38),
  r("arroz-menestra-pescado-frito", "Arroz con menestra y pescado frito", "tilapia", LD, [], M39),
  r("arroz-menestra-lenteja-chicharron-pescado", "Arroz con menestra de lenteja y chicharrón de pescado", "tilapia", LD, [], M39),

  /* ---------- MARISCOS ---------- */
  r("arroz-hamburguesa-camaron", "Arroz con hamburguesa de camarón", "hamburguesa-camaron", LD, [], M38),
  r("arroz-camaron-ajillo", "Arroz con camarón al ajillo", "camaron", LD),
  r("sango-verde-camaron", "Sango de verde con camarón", "camaron", LD, [], M37),
  r("arroz-menestra-frejol-camaron-frito", "Arroz, menestra de fréjol y camarón frito", "camaron", LD, [], M37),
  r("arroz-ceviche-camaron-chifles", "Arroz con ceviche de camarón y chifles", "camaron", LD, [], M38),
  r("arroz-pure-camaron-frito", "Arroz con puré de papa y camarón frito", "camaron", LD, [], M39),

  /* ---------- SOPAS SIN PROTEÍNA ANIMAL ---------- */
  r("caldo-legumbres", "Caldo de legumbres", null, SOUP),
  r("crema-legumbres", "Crema de legumbres", null, SOUP),
  r("locro-papa", "Locro de papa", null, SOUP),
  r("locro-habas", "Locro de habas", null, SOUP),
  r("sopa-lenteja", "Sopa de lenteja", null, SOUP),
  r("sopa-choclo", "Sopa de choclo", null, SOUP),
  r("sopa-frejol", "Sopa de fréjol", null, SOUP),
  r("sopa-frejol-panamito", "Sopa de fréjol panamito", null, SOUP, [], M38),
  r("sopa-tortitas-verde", "Sopa de tortitas de verde", null, SOUP),

  /* ---------- SOPAS · HUESO CARNUDO ---------- */
  r("caldo-hueso", "Caldo de hueso", "hueso-carnudo", SOUP),
  r("caldo-hueso-lenteja", "Caldo de hueso carnudo con lenteja", "hueso-carnudo", SOUP),
  r("menestron-hueso", "Menestrón con hueso carnudo", "hueso-carnudo", SOUP),
  r("sopa-avena-hueso", "Sopa de avena con hueso carnudo de res", "hueso-carnudo", SOUP, ["quaker"]),
  r("sancocho-hueso", "Sancocho de hueso de res", "hueso-carnudo", SOUP),
  r("sopa-verduras-hueso", "Sopa de verduras con hueso carnudo de res", "hueso-carnudo", SOUP),
  r("menestron-frejol-hueso", "Menestrón de fréjol con hueso de res", "hueso-carnudo", SOUP, [], M37),
  r("menestron-lenteja-hueso", "Menestrón de lenteja con hueso carnudo de res", "hueso-carnudo", SOUP, [], M39),

  /* ---------- SOPAS · COSTILLA (semana par) ---------- */
  r("caldo-torrejas-costilla", "Caldo de torrejas con costilla de res", "costilla-res", SOUP, ["costilla-res-prod"], M38),
  r("sancocho-costilla", "Sancocho con costilla", "costilla-res", SOUP, ["costilla-res-prod"]),

  /* ---------- SOPAS · PATA (semana impar) ---------- */
  r("sopa-pata-bolitas-verde", "Sopa de pata de res con bolitas de verde", "pata-res", SOUP, ["pata-res-prod"], M39),
  r("locro-papa-pata", "Locro de papa con pata", "pata-res", SOUP, ["pata-res-prod"]),
  r("sopa-lentejas-pata", "Sopa de lentejas con pata", "pata-res", SOUP, ["pata-res-prod"]),
  r("sancocho-pata", "Sancocho de pata", "pata-res", SOUP, ["pata-res-prod"]),
  r("caldo-pata", "Caldo de pata de res", "pata-res", SOUP, ["pata-res-prod"], M37),

  /* ---------- SOPAS HISTÓRICAS NO PERMITIDAS (regla de sopas) ---------- */
  r("caldo-lentejas-chorizo", "Caldo de lentejas con chorizo", "chorizo", SOUP, [], M37, {
    active: false,
    notes: "Histórico semana 37. No permitida: en sopa solo hueso carnudo, costilla o pata.",
  }),
  r("caldo-bola-verde-hamburguesa", "Caldo de bola de verde rellena de hamburguesa de res", "hamburguesa-res", SOUP, [], M37, {
    active: false,
    notes: "Histórico semana 37. No permitida: en sopa solo hueso carnudo, costilla o pata.",
  }),

  /* ---------- ENSALADAS ---------- */
  r("ens-tomate-cebolla-limon", "Ensalada de tomate y cebolla colorada con limón", null, SAL),
  r("ens-tomate-cebolla", "Ensalada de tomate y cebolla colorada", null, SAL),
  r("ens-rusa", "Ensalada rusa de papa, zanahoria y choclo", null, SAL),
  r("ens-zanahoria-choclo-cebolla", "Ensalada de zanahoria, choclo y cebolla colorada con limón", null, SAL),
  r("ens-col-zanahoria", "Ensalada de col y zanahoria", null, SAL),
  r("ens-col-zanahoria-limon", "Ensalada de col y zanahoria con limón", null, SAL),
  r("ens-tomate-choclo-cebolla", "Ensalada de tomate, choclo y cebolla colorada", null, SAL),
  r("ens-remolacha-zanahoria-cebolla", "Ensalada de remolacha, zanahoria y cebolla colorada", null, SAL, ["remolacha"]),
  r("ens-remolacha-tomate-cebolla", "Ensalada de remolacha, tomate y cebolla colorada", null, SAL, ["remolacha"]),
  r("ens-remolacha-zanahoria", "Ensalada de remolacha y zanahoria", null, SAL, ["remolacha"]),
  r("ens-coliflor-zanahoria-choclo", "Ensalada de coliflor, zanahoria y choclo", null, SAL, ["coliflor"]),
  r("ens-coliflor-tomate-cebolla", "Ensalada de coliflor, tomate y cebolla colorada", null, SAL, ["coliflor"]),
  r("ens-coliflor-tomate", "Ensalada de coliflor y tomate", null, SAL, ["coliflor"]),
  r("ens-pepino-zanahoria", "Ensalada de pepino y zanahoria", null, SAL, ["pepino"]),
  r("ens-fresca-tomate-pepino-cebolla", "Ensalada fresca de tomate, pepino y cebolla colorada con limón", null, SAL, ["pepino"]),
  r("ens-pepino-tomate-cebolla", "Ensalada de pepino, tomate y cebolla colorada", null, SAL, ["pepino"]),
  r("ens-rabano-cebolla-limon", "Ensalada de rábano, cebolla colorada y limón", null, SAL, ["rabano"]),
  r("ens-rabano-pepino-cebolla", "Ensalada de rábano, pepino y cebolla colorada", null, SAL, ["rabano", "pepino"]),
  r("ens-pepino-rabano-cebolla-limon", "Ensalada de pepino, rábano y cebolla colorada con limón", null, SAL, ["pepino", "rabano"]),
  r("ens-pepino-rabano-limon", "Ensalada de pepino y rábano con limón", null, SAL, ["pepino", "rabano"]),
  r("ens-brocoli-zanahoria", "Ensalada de brócoli y zanahoria", null, SAL, ["brocoli"]),
  r("ens-brocoli-tomate-cebolla", "Ensalada de brócoli, tomate y cebolla colorada", null, SAL, ["brocoli"]),
  r("ens-brocoli-zanahoria-choclo", "Ensalada de brócoli, zanahoria y choclo", null, SAL, ["brocoli"]),
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
