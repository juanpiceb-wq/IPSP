import type { Catalog, MenuItem, MenuMetrics, Parity, ValidationIssue, Weekday, WeeklyMenu } from "../types";
import { RULES, allowedBeverages, cycleOrder } from "../rules";
import { WEEKDAYS } from "../types";
import { addConsumption, availableQuantity, inventorySummary, isHardStockKey, recipeConsumptions } from "../supply";
import { SALAD_STOCK_ID, mainAllowsSalad, saladAllowedForMain, saladIngredientViolations, saladTimingReason } from "../salads";
import { blockingReason, buildContext, buildHistoryIndex, isMeaningfulBase, recencyWeight, weeklyDishKey } from "./context";
import { adjacentSauceViolations, hasChickenOnFirstDay, soupCompositionCounts } from "../recipeRules";

export interface ValidateInput {
  items: MenuItem[];
  catalog: Catalog;
  parity: Parity;
  arrival: Weekday;
  year: number;
  week: number;
  campId: string;
  diners: number;
  history: WeeklyMenu[];
}

export interface ValidationResult {
  issues: ValidationIssue[];
  metrics: MenuMetrics;
  unmetTargets: { name: string; target: number; assigned: number }[];
}

export function validateMenu(input: ValidateInput): ValidationResult {
  const { items, catalog, parity } = input;
  const hist = buildHistoryIndex(input.history, input.year, input.week, input.campId, catalog);
  const ctx = buildContext(catalog, parity, input.arrival, hist);
  const issues: ValidationIssue[] = [];
  const mains = items.filter((i) => i.component === "main");
  const soups = items.filter((i) => i.component === "soup");
  const lunchDinner = mains.filter((i) => i.service === "lunch" || i.service === "dinner");

  const mainSlotKeys = new Set(mains.filter((i) => i.recipe_id).map((i) => `${i.weekday}|${i.service}`));
  const expectedMainKeys = WEEKDAYS.flatMap((d) => ["breakfast", "lunch", "dinner"].map((s) => `${d.value}|${s}`));
  const missingMainSlots = expectedMainKeys.filter((k) => !mainSlotKeys.has(k));
  issues.push(missingMainSlots.length
    ? { level: "error", rule: "completo", message: `${missingMainSlots.length} plato(s) fuerte(s) sin preparación asignada.` }
    : { level: "ok", rule: "completo", message: "Los 21 platos fuertes están asignados." });

  const soupDays = new Set(soups.filter((i) => i.recipe_id).map((i) => i.weekday));
  const requiredSoupDays = WEEKDAYS.filter((d) => d.value !== 6);
  const missingSoups = requiredSoupDays.filter((d) => !soupDays.has(d.value));
  const sundaySoup = soups.find((i) => i.weekday === 6 && i.recipe_id);
  if (sundaySoup) {
    issues.push({ level: "error", rule: "domingo-sin-sopa", message: "El domingo no se sirve sopa; retire la sopa del almuerzo dominical.", weekday: 6, service: "lunch" });
  }
  issues.push(missingSoups.length
    ? { level: "error", rule: "sopa-almuerzo", message: `${missingSoups.length} almuerzo(s) de lunes a sábado sin sopa.` }
    : { level: "ok", rule: "sopa-almuerzo", message: "Los almuerzos de lunes a sábado tienen sopa; domingo no lleva sopa." });
  const soupMix = soupCompositionCounts(items, catalog);
  const soupMixProblems: string[] = [];
  if (soupMix.pataOCostilla < 1) soupMixProblems.push("1 sopa de pata o costilla");
  if (soupMix.hueso < 2) soupMixProblems.push("2 sopas con hueso carnudo");
  if (soupMix.crema < 1) soupMixProblems.push("1 crema");
  if (soupMix.menestron < 1) soupMixProblems.push("1 menestrón");
  if (soupMix.sinProteina < 1) soupMixProblems.push("1 sopa sin proteína animal");
  issues.push(soupMixProblems.length
    ? { level: "error", rule: "composicion-sopas", message: `Composición semanal de sopas incompleta: falta ${soupMixProblems.join(", ")}.` }
    : { level: "ok", rule: "composicion-sopas", message: "Sopas: mínimos de pata/costilla, hueso, crema, menestrón y sin proteína cumplidos." });

  let invalid = 0;
  for (const it of items) {
    if (!it.recipe_id) continue;
    const recipe = ctx.recipesById.get(it.recipe_id);
    if (!recipe) {
      invalid++;
      issues.push({ level: "error", rule: "receta", message: "Hay una preparación que ya no existe en el catálogo.", weekday: it.weekday, service: it.service });
      continue;
    }
    const service = it.component === "soup" ? "soup" : it.service;
    const reason = blockingReason(recipe, service, it.weekday, ctx);
    if (reason) {
      invalid++;
      issues.push({ level: "error", rule: "restriccion", message: `${WEEKDAYS[it.weekday].label} · ${labelOf(it)}: ${reason}`, weekday: it.weekday, service: it.service });
    }
  }
  if (!invalid) issues.push({ level: "ok", rule: "restriccion", message: "Todas las preparaciones respetan servicio, paridad, domingo, doble fritura y maduración." });
  const firstCycleDay = cycleOrder(input.arrival)[0];
  if (!hasChickenOnFirstDay(items, input.arrival))
    issues.push({ level: "error", rule: "pollo-primer-dia", message: `El pollo debe prepararse obligatoriamente el primer día posterior a la recepción de víveres (${WEEKDAYS[firstCycleDay].label}).`, weekday: firstCycleDay });
  else issues.push({ level: "ok", rule: "pollo-primer-dia", message: `Pollo programado en el primer día del ciclo (${WEEKDAYS[firstCycleDay].label}).` });

  const sauceProblems = adjacentSauceViolations(items, catalog, input.arrival);
  for (const v of sauceProblems)
    issues.push({ level: "error", rule: "salsa-consecutiva", message: `${v.label}: se repite en el mismo día o en días contiguos (${WEEKDAYS[v.dayA].label} / ${WEEKDAYS[v.dayB].label}).` });
  if (!sauceProblems.length) issues.push({ level: "ok", rule: "salsa-consecutiva", message: "No se repite la misma salsa en el mismo día ni en días contiguos del ciclo." });

  // Domingo fijo / asado: validación explícita para mensajes claros.
  const sundayLunch = mains.find((i) => i.weekday === 6 && i.service === "lunch");
  if (ctx.sundayLunchRecipeId && sundayLunch?.recipe_id !== ctx.sundayLunchRecipeId)
    issues.push({ level: "error", rule: "domingo-almuerzo", message: "El almuerzo del domingo debe ser Ceviche de pescado con chifle." });
  else if (ctx.sundayLunchRecipeId) issues.push({ level: "ok", rule: "domingo-almuerzo", message: "Almuerzo dominical fijo correcto: Ceviche de pescado con chifle." });

  const sundayDinner = mains.find((i) => i.weekday === 6 && i.service === "dinner");
  const sundayDinnerRecipe = sundayDinner?.recipe_id ? ctx.recipesById.get(sundayDinner.recipe_id) : null;
  if (sundayDinnerRecipe && !sundayDinnerRecipe.sunday_roast)
    issues.push({ level: "error", rule: "domingo-cena", message: "La cena del domingo debe ser una preparación asada habilitada." });

  // Una misma familia de plato no puede repetirse durante la semana.
  // Ej.: Chaulafán de camarón + Chaulafán de cerdo = repetición.
  //      Ceviche de camarón + Ceviche de tilapia = repetición.
  const familySeen = new Map<string, { name: string; weekday: Weekday }>();
  let familyRepeats = 0;
  for (const it of items) {
    if (!it.recipe_id) continue;
    const recipe = ctx.recipesById.get(it.recipe_id);
    if (!recipe) continue;
    const dishKey = weeklyDishKey(recipe.name);
    const previous = familySeen.get(dishKey);
    if (previous) {
      familyRepeats++;
      issues.push({
        level: "error",
        rule: "familia-plato-semana",
        message: `${recipe.name} repite la misma familia de plato que ${previous.name}. Una familia de plato solo puede aparecer una vez por semana.`,
        weekday: it.weekday,
        service: it.service,
      });
    } else {
      familySeen.set(dishKey, { name: recipe.name, weekday: it.weekday });
    }
  }
  if (!familyRepeats)
    issues.push({ level: "ok", rule: "familia-plato-semana", message: "No se repiten familias de platos durante la semana." });

  // Los 21 platos fuertes deben tener proteína estructurada y una receta exacta
  // no puede repetirse dentro de la misma semana.
  for (const it of mains) {
    if (!it.protein_id)
      issues.push({ level: "error", rule: "proteina-obligatoria", message: `${WEEKDAYS[it.weekday].label} · ${it.service}: ${it.recipe_name} no tiene proteína estructurada asignada.`, weekday: it.weekday, service: it.service });
  }
  const exactRecipes = new Map<string, MenuItem[]>();
  for (const it of mains) {
    if (!it.recipe_id) continue;
    const arr = exactRecipes.get(it.recipe_id) ?? [];
    arr.push(it);
    exactRecipes.set(it.recipe_id, arr);
  }
  for (const arr of exactRecipes.values()) {
    if (arr.length > 1)
      issues.push({ level: "error", rule: "plato-exacto-repetido", message: `${arr[0].recipe_name} se repite ${arr.length} veces en la semana. Una preparación exacta solo puede aparecer una vez.` });
  }

  // Proteína repetida el mismo día.
  let repeated = 0;
  for (const day of WEEKDAYS) {
    const dayMains = mains.filter((i) => i.weekday === day.value && i.protein_id);
    const seen = new Set<string>();
    for (const it of dayMains) {
      if (seen.has(it.protein_id!)) {
        repeated++;
        issues.push({ level: "error", rule: "proteina-dia", message: `${day.label}: ${ctx.proteinsById.get(it.protein_id!)?.name ?? it.protein_id} se repite dos veces el mismo día.`, weekday: day.value });
      }
      seen.add(it.protein_id!);
    }
  }
  if (!repeated) issues.push({ level: "ok", rule: "proteina-dia", message: "Ninguna proteína se repite dos veces el mismo día." });

  // Separación mínima entre usos de la misma proteína/producto.
  // Aplica sin importar el servicio: debe existir al menos 1 día completo de por medio.
  // La secuencia se valida según el ciclo real del campamento (día posterior a recepción).
  let adjacentProteinRepeats = 0;
  const orderedDays = cycleOrder(input.arrival);
  const cyclePos = new Map<Weekday, number>(orderedDays.map((d, i) => [d, i]));
  const byProtein = new Map<string, Set<Weekday>>();
  for (const it of items) {
    if (!it.recipe_id || !it.protein_id) continue;
    const set = byProtein.get(it.protein_id) ?? new Set<Weekday>();
    set.add(it.weekday);
    byProtein.set(it.protein_id, set);
  }
  for (const [proteinId, daySet] of byProtein) {
    const days = [...daySet].sort((a, b) => (cyclePos.get(a) ?? 0) - (cyclePos.get(b) ?? 0));
    for (let i = 1; i < days.length; i++) {
      const prev = days[i - 1];
      const curr = days[i];
      const distance = (cyclePos.get(curr) ?? 0) - (cyclePos.get(prev) ?? 0);
      if (distance <= RULES.MIN_PROTEIN_GAP_DAYS) {
        adjacentProteinRepeats++;
        issues.push({
          level: "error",
          rule: "proteina-consecutiva",
          message: `${WEEKDAYS[prev].label} → ${WEEKDAYS[curr].label}: ${ctx.proteinsById.get(proteinId)?.name ?? proteinId} requiere al menos 1 día completo de por medio antes de repetirse.`,
          weekday: curr,
        });
      }
    }
  }
  if (!adjacentProteinRepeats) issues.push({ level: "ok", rule: "proteina-consecutiva", message: "Todas las proteínas tienen al menos 1 día completo de separación antes de repetirse." });

  // Origen animal: preferencia, con una excepción semanal para cerdo.
  let porkExceptions = 0;
  for (const day of WEEKDAYS) {
    const origins = mains.filter((i) => i.weekday === day.value && i.protein_id)
      // Chorizo es neutro para la regla de origen animal: no cuenta como cerdo ni como otro origen.
      .map((i) => {
        const protein = ctx.proteinsById.get(i.protein_id!);
        return protein && protein.id !== "chorizo" ? protein.origin : null;
      }).filter(Boolean) as string[];
    const counts = new Map<string, number>();
    origins.forEach((o) => counts.set(o, (counts.get(o) ?? 0) + 1));
    for (const [origin, n] of counts) {
      if (n <= 1) continue;
      if (origin === "cerdo") porkExceptions += n - 1;
      else issues.push({ level: "error", rule: "origen-dia", message: `${day.label}: se repite origen ${origin} en dos platos fuertes. Solo se admite una excepción semanal de origen cerdo.`, weekday: day.value });
    }
  }
  if (porkExceptions > RULES.PORK_EXCEPTIONS_ALLOWED)
    issues.push({ level: "error", rule: "excepcion-cerdo", message: `${porkExceptions} repeticiones de origen cerdo; solo se permite ${RULES.PORK_EXCEPTIONS_ALLOWED} excepción por semana.` });
  else if (porkExceptions) issues.push({ level: "warn", rule: "excepcion-cerdo", message: `${porkExceptions} excepción de origen cerdo utilizada.` });

  // Dificultad diaria máxima 6.
  let maxDailyDifficulty = 0;
  for (const day of WEEKDAYS) {
    const total = mains.filter((i) => i.weekday === day.value && i.recipe_id)
      .reduce((sum, i) => sum + (ctx.recipesById.get(i.recipe_id!)?.difficulty ?? 1), 0);
    maxDailyDifficulty = Math.max(maxDailyDifficulty, total);
    if (total > RULES.MAX_DAILY_DIFFICULTY)
      issues.push({ level: "error", rule: "dificultad-dia", message: `${day.label}: dificultad total ${total}; máximo permitido ${RULES.MAX_DAILY_DIFFICULTY}.`, weekday: day.value });
  }
  if (maxDailyDifficulty <= RULES.MAX_DAILY_DIFFICULTY)
    issues.push({ level: "ok", rule: "dificultad-dia", message: `Carga de cocina controlada: ningún día supera dificultad ${RULES.MAX_DAILY_DIFFICULTY}.` });

  // Ingrediente base no consecutivo según el ciclo real de abastecimiento.
  let baseRepeats = 0;
  const baseOrder = cycleOrder(input.arrival);
  for (let pos = 0; pos < baseOrder.length - 1; pos++) {
    const leftDay = baseOrder[pos];
    const rightDay = baseOrder[pos + 1];
    const left = new Set(mains.filter((i) => i.weekday === leftDay && i.recipe_id)
      .map((i) => ctx.recipesById.get(i.recipe_id!)?.base_ingredient)
      .filter((b): b is string => isMeaningfulBase(b)));
    const right = new Set(mains.filter((i) => i.weekday === rightDay && i.recipe_id)
      .map((i) => ctx.recipesById.get(i.recipe_id!)?.base_ingredient)
      .filter((b): b is string => isMeaningfulBase(b)));
    for (const b of left) if (right.has(b)) {
      baseRepeats++;
      issues.push({ level: "error", rule: "base-consecutiva", message: `${WEEKDAYS[leftDay].label} → ${WEEKDAYS[rightDay].label}: se repite el ingrediente base ${b}.` });
    }
  }
  if (!baseRepeats) issues.push({ level: "ok", rule: "base-consecutiva", message: "No se repiten ingredientes base dominantes en días consecutivos." });

  // Ensaladas: mínimo operativo flexible de 5/14 servicios.
  // Solo se asignan cuando el plato fuerte admite ensalada y la combinación es compatible.
  const forbiddenSalads = lunchDinner.filter((i) => {
    if (!i.salad_recipe_id || !i.recipe_id) return false;
    const main = catalog.recipes.find((r) => r.id === i.recipe_id);
    return !!main && !mainAllowsSalad(main);
  });
  for (const item of forbiddenSalads) {
    const main = item.recipe_id ? catalog.recipes.find((r) => r.id === item.recipe_id) : null;
    issues.push({ level: "error", rule: "ensalada-no-aplica", message: `${WEEKDAYS[item.weekday].label}: ${main?.name ?? "El plato"} no lleva ensalada.`, weekday: item.weekday, service: item.service });
  }
  const saladCount = lunchDinner.filter((i) => !!i.salad_recipe_id).length;
  const saladDays = new Set(lunchDinner.filter((i) => !!i.salad_recipe_id).map((i) => i.weekday)).size;
  if (saladCount < RULES.SALAD_MIN)
    issues.push({ level: "error", rule: "ensaladas", message: `${saladCount}/${RULES.SALAD_SERVICES} servicios con ensalada; se requieren al menos ${RULES.SALAD_MIN}.` });
  else
    issues.push({ level: "ok", rule: "ensaladas", message: `${saladCount}/${RULES.SALAD_SERVICES} servicios con ensalada; cumple el mínimo de ${RULES.SALAD_MIN}.` });
  if (saladCount >= RULES.SALAD_MIN && saladDays < Math.min(RULES.SALAD_MIN, 4))
    issues.push({ level: "warn", rule: "ensaladas-distribucion", message: `Las ${saladCount} ensaladas están concentradas en ${saladDays} día(s). Conviene distribuirlas mejor durante la semana cuando la compatibilidad lo permita.` });
  else if (saladCount >= RULES.SALAD_MIN)
    issues.push({ level: "ok", rule: "ensaladas-distribucion", message: `Ensaladas distribuidas en ${saladDays} días de la semana.` });

  let saladErrors = 0;
  for (const item of lunchDinner) {
    if (!item.salad_recipe_id) continue;
    const salad = catalog.recipes.find((r) => r.id === item.salad_recipe_id);
    if (!salad || !salad.active || !salad.services.includes("salad")) {
      saladErrors++;
      issues.push({ level: "error", rule: "ensalada-catalogo", message: `${WEEKDAYS[item.weekday].label}: la ensalada asignada no pertenece al catálogo activo.`, weekday: item.weekday, service: item.service });
      continue;
    }
    const main = item.recipe_id ? catalog.recipes.find((r) => r.id === item.recipe_id) : null;
    if (main && !saladAllowedForMain(main, salad)) {
      saladErrors++;
      issues.push({ level: "error", rule: "ensalada-compatibilidad", message: `${WEEKDAYS[item.weekday].label} · ${item.service === "lunch" ? "almuerzo" : "cena"}: ${main.name} no debe acompañarse con ${salad.name}.`, weekday: item.weekday, service: item.service });
    }
  }

  const saladIngredientErrors = saladIngredientViolations(lunchDinner);
  for (const x of saladIngredientErrors) {
    saladErrors++;
    issues.push({ level: "warn", rule: "ensalada-ingrediente", message: `${x.label}: aparece en ${x.used} ensaladas; referencia semanal ${x.max} según disponibilidad.` });
  }
  if (!saladErrors)
    issues.push({ level: "ok", rule: "ensalada-reglas", message: "Ensaladas correctas por ciclo, paridad, variedad y límites de ingredientes." });

  // Ingredientes de refrito/acompañamiento no tienen un tope duro semanal.
  issues.push({ level: "ok", rule: "ingredientes-principales", message: "Ingredientes principales registrados sin imponer topes artificiales a refritos y porciones pequeñas." });

  // Bebidas permitidas por servicio/paridad.
  const badBeverage = mains.filter((i) => !i.beverage || !allowedBeverages(i.service, parity).includes(i.beverage));
  if (badBeverage.length)
    issues.push({ level: "error", rule: "bebidas", message: `${badBeverage.length} servicio(s) tienen una bebida no permitida para servicio/paridad.` });
  else issues.push({ level: "ok", rule: "bebidas", message: "Bebidas correctas por servicio y paridad." });

  issues.push({ level: "ok", rule: "arroz", message: "Arroz obligatorio en desayuno, almuerzo y cena; se agrega automáticamente salvo preparaciones con arroz integrado." });

  // Máximos semanales.
  const uses = new Map<string, number>();
  for (const it of items) if (it.protein_id) uses.set(it.protein_id, (uses.get(it.protein_id) ?? 0) + 1);
  let frequencyOverages = 0;
  for (const p of catalog.proteins) {
    if (!p.active || p.target_frequency <= 0 || (p.parity !== "todas" && p.parity !== parity)) continue;
    const assigned = uses.get(p.id) ?? 0;
    if (assigned > p.target_frequency) {
      frequencyOverages++;
      issues.push({ level: "error", rule: "frecuencia", message: `${p.name}: máximo ${p.target_frequency} por semana · asignadas ${assigned}.` });
    }
  }
  if (!frequencyOverages) issues.push({ level: "ok", rule: "frecuencia", message: "Todas las proteínas respetan su máximo semanal configurado." });

  // Stock semanal conocido. Solo compara unidades compatibles del maestro.
  const ledger = new Map<string, number>();
  for (const it of items) {
    if (!it.recipe_id) continue;
    const r = ctx.recipesById.get(it.recipe_id);
    if (r) addConsumption(ledger, r, input.diners);
  }
  let stockErrors = 0;
  for (const row of inventorySummary(ledger, input.diners)) {
    if (isHardStockKey(row.key) && row.used > row.cap + 1e-9) {
      stockErrors++;
      issues.push({ level: "warn", rule: "stock", message: `${row.label}: consumo ${round(row.used)} ${row.unit} > disponible ${round(row.cap)} ${row.unit}.` });
    }
  }
  if (!stockErrors) issues.push({ level: "ok", rule: "stock", message: "Consumos estimados dentro de las referencias semanales del cuadro de víveres." });

  const menuComplete = missingMainSlots.length === 0 && missingSoups.length === 0 && !sundaySoup;
  const variety = menuComplete ? varietyScore(items, ctx.history, ctx.recipesById) : 0;
  if (!menuComplete)
    issues.push({ level: "warn", rule: "variedad", message: "La variedad no se califica hasta completar los 21 platos fuertes y las 6 sopas de lunes a sábado." });
  else
    issues.push({ level: variety >= 80 ? "ok" : "warn", rule: "variedad", message: `Variedad respecto a las últimas ${RULES.HISTORY_WEEKS} semanas: ${variety}%.` });

  const errors = issues.filter((i) => i.level === "error").length;
  const warnings = issues.filter((i) => i.level === "warn").length;
  const compliance = Math.max(0, Math.round(100 - errors * 12 - warnings * 3));
  const inventoryRows = inventorySummary(ledger, input.diners);
  const inventoryUsePct = inventoryRows.length ? Math.round(inventoryRows.reduce((s, x) => s + Math.min(100, x.pct), 0) / inventoryRows.length) : 0;

  const metrics: MenuMetrics = {
    mainCount: mains.filter((i) => i.recipe_id).length,
    soupCount: soups.filter((i) => i.recipe_id).length,
    saladCount,
    saladTarget: RULES.SALAD_TARGET,
    errors,
    warnings,
    varietyScore: variety,
    complianceScore: compliance,
    porkExceptions,
    maxDailyDifficulty,
    inventoryUsePct,
  };
  const unmetTargets = catalog.proteins
    .filter((p) => p.active && !p.soup_only && p.target_frequency > 0 && (p.parity === "todas" || p.parity === parity))
    .map((p) => ({ name: p.name, target: p.target_frequency, assigned: mains.filter((i) => i.protein_id === p.id).length }))
    .filter((x) => x.assigned < x.target);
  return { issues, metrics, unmetTargets };
}

function labelOf(it: MenuItem) {
  if (it.component === "soup") return "sopa";
  return it.service === "breakfast" ? "desayuno" : it.service === "lunch" ? "almuerzo" : "cena";
}

export function varietyScore(
  items: MenuItem[],
  history: ReturnType<typeof buildHistoryIndex>,
  recipesById?: Map<string, { base_ingredient?: string | null }>
): number {
  const relevant = items.filter((i) => i.recipe_id);
  if (!relevant.length) return 0;
  let penalty = 0;
  for (const it of relevant) {
    const rAgo = history.recipeAgo.get(it.recipe_id!);
    penalty += recencyWeight(rAgo) * (rAgo === 1 ? 1.35 : 1);
    penalty += recencyWeight(history.recipeSlotAgo.get(`${it.recipe_id}|${it.weekday}|${it.service}|${it.component}`)) * 0.8;
    if (it.protein_id) penalty += recencyWeight(history.proteinSlotAgo.get(`${it.protein_id}|${it.weekday}|${it.service}`)) * 0.5;
    const base = recipesById?.get(it.recipe_id!)?.base_ingredient;
    if (isMeaningfulBase(base)) penalty += recencyWeight(history.baseAgo.get(base!)) * 0.35;
  }
  const max = relevant.length * 3;
  return Math.max(0, Math.round(100 - (penalty / max) * 100));
}

export function menuStockReason(items: MenuItem[], candidate: { recipe_id: string | null }, catalog: Catalog, diners: number) {
  if (!candidate.recipe_id) return null;
  const recipe = catalog.recipes.find((r) => r.id === candidate.recipe_id);
  if (!recipe) return null;
  const ledger = new Map<string, number>();
  for (const it of items) {
    if (!it.recipe_id) continue;
    const r = catalog.recipes.find((x) => x.id === it.recipe_id);
    if (r) addConsumption(ledger, r, diners);
  }
  for (const c of recipeConsumptions(recipe, diners)) {
    const cap = availableQuantity(c.key, diners);
    // El consumo es informativo: nunca bloquea una preparación.\n    if (isHardStockKey(c.key) && cap != null && (ledger.get(c.key) ?? 0) + c.quantity > cap + 1e-9) continue;
  }
  return null;
}

function round(v: number) { return Math.round(v * 100) / 100; }





