import type { Catalog, MainService, MenuItem, Parity, Recipe, Weekday, WeeklyMenu } from "../types";
import { RULES, SUNDAY_PREFERRED_PROTEINS, beverageLabel, cycleOrder } from "../rules";
import { addConsumption, canConsume } from "../supply";
import {
  EngineContext,
  MAIN_SERVICE_ORDER,
  buildContext,
  buildHistoryIndex,
  isEligible,
  isMeaningfulBase,
  makeRng,
  recencyWeight,
} from "./context";

export interface GenerateInput {
  year: number;
  week: number;
  parity: Parity;
  campId: string;
  diners: number;
  arrival: Weekday;
  catalog: Catalog;
  history: WeeklyMenu[];
  locked?: MenuItem[];
  seed?: string;
}

export interface GenerateOutput {
  items: MenuItem[];
  seed: string;
  unmetTargets: { proteinId: string; name: string; target: number; assigned: number }[];
  capacityWarning: string | null;
}

interface Candidate { recipe: Recipe; score: number; reasons: string[]; }

export function generateMenu(input: GenerateInput): GenerateOutput {
  const baseSeed = input.seed ?? `${Date.now()}-${globalThis.crypto?.randomUUID?.() ?? "seed"}`;
  const feasibility = mainCapacityDiagnostic(input);

  // Si las propias reglas hacen imposible llegar a 21, no quemamos decenas de
  // intentos. Generamos la mejor propuesta parcial y mostramos la causa matemática.
  if (feasibility.maxMainMeals < RULES.MAIN_SLOTS) {
    const partial = generateMenuAttempt(input, baseSeed);
    return { ...partial, capacityWarning: feasibility.message };
  }

  let best = generateMenuAttempt(input, baseSeed);
  for (let attempt = 1; attempt <= 12; attempt++) {
    if (isCompleteGeneration(best, input)) return best;
    const candidate = generateMenuAttempt(input, `${baseSeed}-${attempt}`);
    if (generationQuality(candidate, input) > generationQuality(best, input)) best = candidate;
  }
  return best;
}

function generateMenuAttempt(input: GenerateInput, seed: string): GenerateOutput {
  const rng = makeRng(seed);
  const hist = buildHistoryIndex(input.history, input.year, input.week, input.campId, input.catalog);
  const ctx = buildContext(input.catalog, input.parity, input.arrival, hist);
  const lockedMap = new Map<string, MenuItem>();
  for (const it of input.locked ?? []) {
    // El domingo no existe servicio de sopa. Ignoramos bloqueos históricos de ese slot.
    if (it.locked && !(it.weekday === 6 && it.component === "soup"))
      lockedMap.set(key(it.weekday, it.service, it.component), it);
  }

  const initial: SearchState = {
    items: [],
    usedRecipes: new Set<string>(),
    proteinUses: new Map<string, number>(),
    dayProteins: new Map<Weekday, Set<string>>(),
    dayOrigins: new Map<Weekday, string[]>(),
    ledger: new Map<string, number>(),
    porkExceptions: 0,
  };

  // Los elementos bloqueados participan desde el principio en stock, dificultad,
  // máximos y origen animal. Así "Regenerar resto" nunca ignora lo ya fijado.
  for (const it of lockedMap.values()) {
    initial.items.push({ ...it });
    const r = it.recipe_id ? ctx.recipesById.get(it.recipe_id) : null;
    if (r) {
      initial.usedRecipes.add(r.id);
      addConsumption(initial.ledger, r, input.diners);
    }
    if (it.protein_id) {
      initial.proteinUses.set(it.protein_id, (initial.proteinUses.get(it.protein_id) ?? 0) + 1);
      if (it.component === "main") {
        addDay(initial.dayProteins, it.weekday, it.protein_id);
        const selectedProtein = ctx.proteinsById.get(it.protein_id);
        if (selectedProtein && selectedProtein.id !== "chorizo")
          pushOrigin(initial.dayOrigins, it.weekday, selectedProtein.origin);
      }
    }
    if (it.salad_recipe_id) initial.usedRecipes.add(it.salad_recipe_id);
  }
  initial.porkExceptions = countPorkExceptions(initial.dayOrigins);

  const order = cycleOrder(input.arrival);
  const allMainSlots = order.flatMap((weekday) => MAIN_SERVICE_ORDER.map((service) => ({ weekday, service })));
  // Los dos espacios dominicales son los más restrictivos y se resuelven primero.
  const mainSlots = allMainSlots
    .filter((slot) => !lockedMap.has(key(slot.weekday, slot.service, "main")))
    .sort((a, b) => slotPriority(a.weekday, a.service) - slotPriority(b.weekday, b.service));

  const mainSearch: SearchConfig = {
    input, ctx, rng, component: "main", nodeBudget: { used: 0, max: 30000 }, bestDepth: 0, bestState: cloneState(initial),
  };
  const mainsResult = searchSlots(initial, mainSlots, 0, mainSearch);

  const afterMains = mainsResult ?? mainSearch.bestState ?? initial;
  const soupSlots = order
    // Nueva regla dura: domingo no se sirve sopa.
    .filter((weekday) => weekday !== 6)
    .map((weekday) => ({ weekday, service: "lunch" as MainService }))
    .filter((slot) => !lockedMap.has(key(slot.weekday, slot.service, "soup")));
  const soupSearch: SearchConfig = {
    input, ctx, rng, component: "soup", nodeBudget: { used: 0, max: 4000 }, bestDepth: 0, bestState: cloneState(afterMains),
  };
  const soupResult = searchSlots(afterMains, soupSlots, 0, soupSearch);

  const finalState = soupResult ?? soupSearch.bestState ?? afterMains;
  const items = [...finalState.items];

  // Si una búsqueda no pudo completar, se agregan placeholders para que la interfaz
  // muestre exactamente qué slots faltan; esos resultados jamás cuentan como válidos.
  for (const weekday of order) {
    for (const service of MAIN_SERVICE_ORDER) {
      const k = key(weekday, service, "main");
      if (!items.some((i) => key(i.weekday, i.service, i.component) === k))
        items.push(makeItem(weekday, service, "main", null, beverageLabel(service, input.parity)));
    }
    if (weekday !== 6) {
      const sk = key(weekday, "lunch", "soup");
      if (!items.some((i) => key(i.weekday, i.service, i.component) === sk))
        items.push(makeItem(weekday, "lunch", "soup", null, null));
    }
  }

  assignSalads(items, input, ctx, rng, finalState.usedRecipes);
  items.sort(sortItems);

  const missing = items.filter((i) => !i.recipe_id).length;
  const capacityWarning = missing
    ? `Quedaron ${missing} espacio(s) sin candidato válido. El motor agotó combinaciones compatibles; no se puede aprobar ni exportar este menú como definitivo.`
    : null;
  const unmetTargets = input.catalog.proteins
    .filter((p) => p.active && !p.soup_only && p.target_frequency > 0 && (p.parity === "todas" || p.parity === input.parity))
    .map((p) => ({ proteinId: p.id, name: p.name, target: p.target_frequency, assigned: finalState.proteinUses.get(p.id) ?? 0 }))
    .filter((x) => x.assigned < x.target);
  return { items, seed, unmetTargets, capacityWarning };
}

interface SearchState {
  items: MenuItem[];
  usedRecipes: Set<string>;
  proteinUses: Map<string, number>;
  dayProteins: Map<Weekday, Set<string>>;
  dayOrigins: Map<Weekday, string[]>;
  ledger: Map<string, number>;
  porkExceptions: number;
}

interface SearchConfig {
  input: GenerateInput;
  ctx: EngineContext;
  rng: () => number;
  component: "main" | "soup";
  nodeBudget: { used: number; max: number };
  bestDepth: number;
  bestState: SearchState | null;
}

/**
 * Backtracking acotado. Si una elección deja sin opciones a un slot posterior,
 * retrocede y prueba otra preparación en lugar de dejar un guion en el menú.
 */
function searchSlots(
  state: SearchState,
  slots: { weekday: Weekday; service: MainService }[],
  index: number,
  cfg: SearchConfig
): SearchState | null {
  if (index > cfg.bestDepth) {
    cfg.bestDepth = index;
    cfg.bestState = cloneState(state);
  }
  if (index >= slots.length) return state;
  if (++cfg.nodeBudget.used > cfg.nodeBudget.max) return null;

  const slot = slots[index];
  const candidates = candidateList({
    ctx: cfg.ctx,
    rng: cfg.rng,
    weekday: slot.weekday,
    service: slot.service,
    component: cfg.component,
    catalog: cfg.input.catalog,
    usedRecipes: state.usedRecipes,
    proteinUses: state.proteinUses,
    dayProteins: state.dayProteins,
    dayOrigins: state.dayOrigins,
    porkExceptions: state.porkExceptions,
    porkBudget: RULES.PORK_EXCEPTIONS_ALLOWED,
    items: state.items,
    ledger: state.ledger,
    diners: cfg.input.diners,
    arrival: cfg.input.arrival,
  });

  // Se exploran primero las mejores opciones, pero con un pool suficiente para
  // resolver callejones sin salida producidos por stock, origen o ingredientes base.
  for (const cand of candidates.slice(0, cfg.component === "main" ? 18 : 14)) {
    const next = cloneState(state);
    const beforePork = countPorkExceptions(next.dayOrigins);
    registerChoice(
      cand.recipe,
      slot.weekday,
      cfg.ctx,
      next.usedRecipes,
      next.proteinUses,
      next.dayProteins,
      next.dayOrigins,
      next.ledger,
      cfg.input.diners,
      cfg.component === "main"
    );
    next.porkExceptions = Math.max(beforePork, countPorkExceptions(next.dayOrigins));
    next.items.push(makeItem(
      slot.weekday,
      slot.service,
      cfg.component,
      cand,
      cfg.component === "main" ? beverageLabel(slot.service, cfg.input.parity) : null
    ));

    const solved = searchSlots(next, slots, index + 1, cfg);
    if (solved) return solved;
  }
  return null;
}

function cloneState(state: SearchState): SearchState {
  return {
    items: state.items.map((i) => ({ ...i, reasons: [...i.reasons] })),
    usedRecipes: new Set(state.usedRecipes),
    proteinUses: new Map(state.proteinUses),
    dayProteins: new Map([...state.dayProteins].map(([d, set]) => [d, new Set(set)])),
    dayOrigins: new Map([...state.dayOrigins].map(([d, arr]) => [d, [...arr]])),
    ledger: new Map(state.ledger),
    porkExceptions: state.porkExceptions,
  };
}

function countPorkExceptions(dayOrigins: Map<Weekday, string[]>) {
  let total = 0;
  for (const origins of dayOrigins.values()) {
    const pork = origins.filter((o) => o === "cerdo").length;
    if (pork > 1) total += pork - 1;
  }
  return total;
}

function slotPriority(weekday: Weekday, service: MainService) {
  if (weekday === 6 && service === "lunch") return 0;
  if (weekday === 6 && service === "dinner") return 1;
  if (service === "breakfast") return 2 + weekday * 3;
  if (service === "lunch") return 3 + weekday * 3;
  return 4 + weekday * 3;
}

interface PickArgs {
  ctx: EngineContext;
  rng: () => number;
  weekday: Weekday;
  service: MainService;
  component: "main" | "soup";
  catalog: Catalog;
  usedRecipes: Set<string>;
  proteinUses: Map<string, number>;
  dayProteins: Map<Weekday, Set<string>>;
  dayOrigins: Map<Weekday, string[]>;
  porkExceptions: number;
  porkBudget: number;
  items: MenuItem[];
  ledger: Map<string, number>;
  diners: number;
  arrival: Weekday;
}

function candidateList(a: PickArgs): Candidate[] {
  const service = a.component === "soup" ? "soup" : a.service;
  const candidates: Candidate[] = [];
  for (const recipe of a.catalog.recipes) {
    if (!recipe.active || a.usedRecipes.has(recipe.id)) continue;
    if (!isEligible(recipe, service, a.weekday, a.ctx)) continue;

    const proteinId = recipe.primary_protein_id;
    const protein = proteinId ? a.ctx.proteinsById.get(proteinId) : null;
    if (protein && protein.target_frequency > 0 && (a.proteinUses.get(protein.id) ?? 0) >= protein.target_frequency) continue;
    if (a.component === "main" && proteinId && a.dayProteins.get(a.weekday)?.has(proteinId)) continue;
    // Regla dura: cualquier misma proteína/producto debe dejar al menos un día completo
    // de por medio antes de volver a programarse, sin importar el servicio.
    // Ej.: lunes -> miércoles permitido; lunes -> martes prohibido.
    if (proteinId && violatesProteinGap(a.items, a.weekday, proteinId, a.arrival)) continue;

    if (a.component === "main") {
      const difficulty = recipe.difficulty ?? 1;
      if (dayDifficulty(a.items, a.weekday, a.ctx) + difficulty > RULES.MAX_DAILY_DIFFICULTY) continue;
      if (hasAdjacentBase(a.items, a.weekday, recipe.base_ingredient, a.ctx, a.arrival)) continue;
    }

    const stockReason = canConsume(a.ledger, recipe, a.diners);
    if (stockReason) continue;

    const reasons: string[] = [];
    let score = 100;
    const rAgo = a.ctx.history.recipeAgo.get(recipe.id);
    if (rAgo !== undefined) {
      const w = recencyWeight(rAgo);
      score -= (rAgo === 1 ? 115 : 75) * w;
      reasons.push(`Utilizada hace ${rAgo} semana${rAgo === 1 ? "" : "s"}.`);
    } else reasons.push(`No utilizada en las últimas ${RULES.HISTORY_WEEKS} semanas.`);

    const slotAgo = a.ctx.history.recipeSlotAgo.get(`${recipe.id}|${a.weekday}|${a.service}|${a.component}`);
    if (slotAgo !== undefined) score -= 45 * recencyWeight(slotAgo);

    if (proteinId) {
      const pSlot = a.ctx.history.proteinSlotAgo.get(`${proteinId}|${a.weekday}|${a.service}`);
      if (pSlot !== undefined) score -= 25 * recencyWeight(pSlot);
      const pAgo = a.ctx.history.proteinAgo.get(proteinId);
      if (pAgo !== undefined) score -= 12 * recencyWeight(pAgo);

      // Además de la separación mínima dura, premiamos una separación mayor
      // dentro de la misma semana cuando matemáticamente sea posible.
      const gap = closestProteinGap(a.items, a.weekday, proteinId, a.arrival);
      if (gap != null) score += Math.min(28, Math.max(0, gap - (RULES.MIN_PROTEIN_GAP_DAYS + 1)) * 9);
    }

    if (isMeaningfulBase(recipe.base_ingredient)) {
      const bAgo = a.ctx.history.baseAgo.get(recipe.base_ingredient!);
      if (bAgo !== undefined) {
        score -= (bAgo === 1 ? 45 : 25) * recencyWeight(bAgo);
        reasons.push(`Ingrediente base ${recipe.base_ingredient} usado recientemente.`);
      }
    }

    if (protein && protein.target_frequency > 0) {
      const uses = a.proteinUses.get(protein.id) ?? 0;
      const remainingShare = Math.max(0, protein.target_frequency - uses) / protein.target_frequency;
      score += uses === 0 ? 58 : 34 * remainingShare;
      reasons.push(`${protein.name}: ${uses} de máximo/objetivo ${protein.target_frequency} asignadas.`);
    }

    // Conviene consumir primero en desayuno las proteínas que no pueden aprovecharse
    // en almuerzo/cena. Así no se desperdician cupos de Atún/Huevo y quedan proteínas
    // generales suficientes para completar los 14 platos fuertes restantes.
    if (a.component === "main" && a.service === "breakfast" && protein?.breakfast_only) score += 140;
    if (a.component === "main" && a.service === "breakfast" && recipe.id === "corviche-de-sardina") score += 90;

    if (a.component === "main" && protein) {
      // El chorizo es una categoría operativa neutra para la regla de origen animal.
      // Mantiene su máximo semanal y no puede repetirse como proteína el mismo día,
      // pero puede coincidir con cualquier origen sin consumir la excepción de cerdo.
      const rotationOrigin = protein.id === "chorizo" ? null : protein.origin;
      const origins = a.dayOrigins.get(a.weekday) ?? [];
      if (rotationOrigin && origins.includes(rotationOrigin)) {
        if (rotationOrigin === "cerdo") {
          if (a.porkExceptions >= a.porkBudget) continue;
          score -= 220;
          reasons.push("Usa la única excepción semanal permitida de origen cerdo repetido.");
        } else {
          // Res, pollo, pescado, marisco y huevo no se repiten en dos platos fuertes
          // del mismo día. La única excepción semanal admitida es de origen cerdo.
          continue;
        }
      }
    }

    if (a.component === "main" && a.weekday === 6 && proteinId && SUNDAY_PREFERRED_PROTEINS.includes(proteinId)) score += 18;
    if (recipe.sunday_roast && a.weekday === 6 && a.service === "dinner") score += 60;
    score -= (recipe.difficulty ?? 1) * 2;
    score += a.rng() * 10;
    candidates.push({ recipe, score, reasons });
  }

  candidates.sort((x, y) => y.score - x.score);
  return candidates;
}

function registerChoice(
  recipe: Recipe,
  weekday: Weekday,
  ctx: EngineContext,
  usedRecipes: Set<string>,
  proteinUses: Map<string, number>,
  dayProteins: Map<Weekday, Set<string>>,
  dayOrigins: Map<Weekday, string[]>,
  ledger: Map<string, number>,
  diners: number,
  main = true
) {
  usedRecipes.add(recipe.id);
  addConsumption(ledger, recipe, diners);
  const pid = recipe.primary_protein_id;
  if (!pid) return;
  proteinUses.set(pid, (proteinUses.get(pid) ?? 0) + 1);
  if (!main) return;
  addDay(dayProteins, weekday, pid);
  const selectedProtein = ctx.proteinsById.get(pid);
  // Chorizo no pertenece a ningún origen para la regla de rotación animal.
  if (selectedProtein && selectedProtein.id !== "chorizo") pushOrigin(dayOrigins, weekday, selectedProtein.origin);
}

function makeItem(weekday: Weekday, service: MainService, component: "main" | "soup", cand: Candidate | null, beverage: string | null): MenuItem {
  return {
    weekday, service, component,
    recipe_id: cand?.recipe.id ?? null,
    protein_id: cand?.recipe.primary_protein_id ?? null,
    salad_recipe_id: null,
    beverage,
    locked: false,
    reasons: cand?.reasons ?? ["No se encontró una preparación válida para este espacio."],
    execution_status: "pending",
    replacement_name: null,
  };
}

function dayDifficulty(items: MenuItem[], weekday: Weekday, ctx: EngineContext) {
  return items
    .filter((i) => i.weekday === weekday && i.component === "main" && i.recipe_id)
    .reduce((sum, i) => sum + (ctx.recipesById.get(i.recipe_id!)?.difficulty ?? 1), 0);
}

function cycleIndex(weekday: Weekday, arrival: Weekday) {
  return cycleOrder(arrival).indexOf(weekday);
}

function closestProteinGap(items: MenuItem[], weekday: Weekday, proteinId: string, arrival: Weekday): number | null {
  const current = cycleIndex(weekday, arrival);
  const distances = items
    .filter((i) => i.protein_id === proteinId && i.recipe_id)
    .map((i) => Math.abs(current - cycleIndex(i.weekday, arrival)));
  return distances.length ? Math.min(...distances) : null;
}

function violatesProteinGap(items: MenuItem[], weekday: Weekday, proteinId: string, arrival: Weekday) {
  const gap = closestProteinGap(items, weekday, proteinId, arrival);
  if (gap == null) return false;
  // gap=0 mismo día; gap=1 día consecutivo. Para repetir debe existir al menos
  // un día completo intermedio, por lo que la distancia mínima válida es 2.
  return gap <= RULES.MIN_PROTEIN_GAP_DAYS;
}

function hasAdjacentBase(
  items: MenuItem[],
  weekday: Weekday,
  base: string | null | undefined,
  ctx: EngineContext,
  arrival: Weekday
) {
  if (!isMeaningfulBase(base)) return false;
  const order = cycleOrder(arrival);
  const current = order.indexOf(weekday);
  return items.some((i) => {
    if (i.component !== "main" || !i.recipe_id) return false;
    const other = order.indexOf(i.weekday);
    if (other < 0 || Math.abs(other - current) !== 1) return false;
    return ctx.recipesById.get(i.recipe_id)?.base_ingredient === base;
  });
}

function assignSalads(items: MenuItem[], input: GenerateInput, ctx: EngineContext, rng: () => number, usedRecipes: Set<string>) {
  const targets = items.filter((i) => i.component === "main" && !!i.recipe_id && (i.service === "lunch" || i.service === "dinner"));
  const lockedWith = targets.filter((i) => i.locked && i.salad_recipe_id).length;
  const desired = RULES.SALAD_TARGET;
  // Los platos D3 son los primeros candidatos a ir sin ensalada. Solo reciben ensalada
  // si hace falta para alcanzar el mínimo semanal de 10/14.
  const free = targets
    .filter((i) => !i.locked)
    .map((x) => ({ x, difficulty: x.recipe_id ? (ctx.recipesById.get(x.recipe_id)?.difficulty ?? 1) : 1, n: rng() }))
    .sort((a, b) => a.difficulty - b.difficulty || a.n - b.n)
    .map((x) => x.x);
  const needed = Math.max(0, desired - lockedWith);
  free.forEach((item, idx) => {
    if (idx >= needed) { item.salad_recipe_id = null; return; }
    const options = input.catalog.recipes
      .filter((r) => r.active && r.services.includes("salad") && !usedRecipes.has(r.id) && isEligible(r, "salad", item.weekday, ctx))
      .map((r) => ({ r, s: 100 - 60 * recencyWeight(ctx.history.recipeAgo.get(r.id)) + rng() * 10 }))
      .sort((a, b) => b.s - a.s);
    const pick = options[0]?.r;
    if (pick) { item.salad_recipe_id = pick.id; usedRecipes.add(pick.id); }
  });
}


function mainCapacityDiagnostic(input: GenerateInput) {
  const byOrigin = new Map<string, number>();
  let neutralCapacity = 0;
  let shrimpHandled = false;

  for (const p of input.catalog.proteins) {
    if (!p.active || p.soup_only || p.target_frequency <= 0) continue;
    const hardParity = p.id === "atun" || p.id === "costilla-res" ? "par"
      : p.id === "sardina" || p.id === "pata-res" ? "impar"
      : p.parity;
    if (hardParity !== "todas" && hardParity !== input.parity) continue;

    let cap = p.target_frequency;
    if (p.id === "fritada") cap = Math.min(cap, 3); // Regla operativa vigente: 3 servicios semanales.
    if (p.id === "sardina") cap = Math.min(cap, 1); // 60 latas/100 = 1 comida completa.
    if (p.id === "tilapia") cap = Math.min(cap, 1); // reservado al ceviche dominical.
    if (p.id === "camaron" || p.id === "hamburguesa-camaron") {
      if (shrimpHandled) continue;
      shrimpHandled = true;
      cap = 1; // camarón y hamburguesa de camarón comparten una sola comida.
    }

    if (p.id === "chorizo") {
      // Chorizo conserva su máximo semanal, pero no ocupa cupo de ningún origen animal.
      neutralCapacity += cap;
      continue;
    }
    byOrigin.set(p.origin, (byOrigin.get(p.origin) ?? 0) + cap);
  }

  const porkAvailable = byOrigin.get("cerdo") ?? 0;
  const nonPork = [...byOrigin.entries()].filter(([origin]) => origin !== "cerdo").reduce((sum, [, n]) => sum + n, 0);
  const porkPlaceable = Math.min(porkAvailable, 7 + RULES.PORK_EXCEPTIONS_ALLOWED);
  const maxMainMeals = neutralCapacity + nonPork + porkPlaceable;
  const rawCapacity = neutralCapacity + nonPork + porkAvailable;
  const parts = [
    `Con las reglas actuales pueden ubicarse hasta ${maxMainMeals}/${RULES.MAIN_SLOTS} platos fuertes en semana ${input.parity}.`,
    `Capacidad por máximos/stock: ${rawCapacity}; Chorizo aporta ${neutralCapacity} servicio(s) neutrales y no cuenta como cerdo ni como otro origen animal. El origen cerdo aporta ${porkAvailable}, de los cuales pueden ubicarse ${porkPlaceable} bajo la regla de ${RULES.PORK_EXCEPTIONS_ALLOWED} excepción semanal.`,
  ];
  if (input.parity === "impar") parts.push("En semana impar Sardina queda además limitada por stock a 1 comida y Camarón/Hamburguesa de camarón comparten 1 sola comida.");
  parts.push("El sistema no romperá máximos ni stock: ajuste una capacidad/regla o incorpore otra proteína válida para completar 21/21.");
  return { maxMainMeals, message: parts.join(" ") };
}

function generationQuality(out: GenerateOutput, input: GenerateInput) {
  const mains = out.items.filter((i) => i.component === "main" && i.recipe_id).length;
  const soups = out.items.filter((i) => i.component === "soup" && i.recipe_id).length;
  const salads = out.items.filter((i) => i.component === "main" && (i.service === "lunch" || i.service === "dinner") && i.salad_recipe_id).length;
  const uses = new Map<string, number>();
  out.items.filter((i) => i.component === "main" && i.protein_id).forEach((i) => uses.set(i.protein_id!, (uses.get(i.protein_id!) ?? 0) + 1));
  let targetCoverage = 0;
  for (const p of input.catalog.proteins) {
    if (!p.active || p.soup_only || p.target_frequency <= 0 || (p.parity !== "todas" && p.parity !== input.parity)) continue;
    targetCoverage += Math.min(uses.get(p.id) ?? 0, p.target_frequency) / p.target_frequency;
  }
  const saladScore = salads === RULES.SALAD_TARGET ? 80 : Math.max(0, 60 - Math.abs(salads - RULES.SALAD_TARGET) * 10);
  return mains * 1000 + soups * 100 + saladScore + targetCoverage * 20;
}

function isCompleteGeneration(out: GenerateOutput, input: GenerateInput) {
  const mains = out.items.filter((i) => i.component === "main" && i.recipe_id).length;
  const soups = out.items.filter((i) => i.component === "soup" && i.recipe_id).length;
  const salads = out.items.filter((i) => i.component === "main" && (i.service === "lunch" || i.service === "dinner") && i.salad_recipe_id).length;
  if (mains !== RULES.MAIN_SLOTS || soups !== RULES.SOUP_SLOTS || salads < RULES.SALAD_MIN) return false;
  const uses = new Map<string, number>();
  for (const it of out.items) if (it.protein_id) uses.set(it.protein_id, (uses.get(it.protein_id) ?? 0) + 1);
  for (const p of input.catalog.proteins) {
    if (!p.active || p.target_frequency <= 0 || (p.parity !== "todas" && p.parity !== input.parity)) continue;
    if ((uses.get(p.id) ?? 0) > p.target_frequency) return false;
  }
  return true;
}

function key(weekday: Weekday, service: MainService, component: "main" | "soup") { return `${weekday}|${service}|${component}`; }
function addDay(map: Map<Weekday, Set<string>>, weekday: Weekday, proteinId: string) { const set = map.get(weekday) ?? new Set<string>(); set.add(proteinId); map.set(weekday, set); }
function pushOrigin(map: Map<Weekday, string[]>, weekday: Weekday, origin: string) { const arr = map.get(weekday) ?? []; arr.push(origin); map.set(weekday, arr); }
const SERVICE_RANK: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2 };
export function sortItems(a: MenuItem, b: MenuItem) {
  if (a.weekday !== b.weekday) return a.weekday - b.weekday;
  const ra = SERVICE_RANK[a.service] * 2 + (a.component === "soup" ? -1 : 0);
  const rb = SERVICE_RANK[b.service] * 2 + (b.component === "soup" ? -1 : 0);
  return ra - rb;
}






