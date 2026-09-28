"use server";

import { revalidatePath } from "next/cache";
import { getRepo, newId, slugify } from "@/lib/db";
import { generateMenu } from "@/lib/engine/generate";
import { validateMenu } from "@/lib/engine/validate";
import { cycleDates } from "@/lib/dates";
import { parityOfWeek } from "@/lib/rules";
import { assertCanManageExecution, assertGeneralAdmin } from "@/lib/access";
import type {
  Camp,
  ExecutionStatus,
  MenuItem,
  MenuStatus,
  Protein,
  Recipe,
  RestrictiveProduct,
  Weekday,
  WeeklyMenu,
  Zone,
} from "@/lib/types";

export interface GenerateRequest {
  year: number;
  week: number;
  campId: string;
  diners: number;
  arrival: Weekday;
  locked?: MenuItem[];
  seed?: string;
}

export interface GenerateResponse {
  items: MenuItem[];
  seed: string;
  issues: ReturnType<typeof validateMenu>["issues"];
  metrics: ReturnType<typeof validateMenu>["metrics"];
  capacityWarning: string | null;
  start: string;
  end: string;
}

export async function actionGenerate(req: GenerateRequest): Promise<GenerateResponse> {
  const repo = getRepo();
  const [catalog, history] = await Promise.all([repo.getCatalog(), repo.listMenus()]);
  const parity = parityOfWeek(req.week);
  const gen = generateMenu({
    year: req.year, week: req.week, parity, campId: req.campId, diners: req.diners,
    arrival: req.arrival, catalog, history, locked: req.locked, seed: req.seed,
  });
  const validation = validateMenu({
    items: gen.items, catalog, parity, arrival: req.arrival, year: req.year, week: req.week,
    campId: req.campId, diners: req.diners, history,
  });
  const { start, end } = cycleDates(req.year, req.week, req.arrival);
  return { items: gen.items, seed: gen.seed, issues: validation.issues, metrics: validation.metrics, capacityWarning: gen.capacityWarning, start, end };
}

export interface BulkCampResult {
  campId: string;
  campName: string;
  diners: number;
  arrival: Weekday;
  shiftDays: number;
  errors: number;
  warnings: number;
  varietyScore: number;
}

export async function actionGenerateBulk(req: { year: number; week: number; campIds: string[]; seed?: string }) {
  const repo = getRepo();
  const [catalog, history] = await Promise.all([repo.getCatalog(), repo.listMenus()]);
  const camps = req.campIds.map((id) => catalog.camps.find((c) => c.id === id)).filter((c): c is Camp => !!c && c.active);
  if (!camps.length) throw new Error("Seleccione al menos un campamento activo.");
  const parity = parityOfWeek(req.week);
  let best: { gen: ReturnType<typeof generateMenu>; results: BulkCampResult[]; score: number } | null = null;

  for (let attempt = 0; attempt < 80; attempt++) {
    const base = camps[0];
    const gen = generateMenu({
      year: req.year, week: req.week, parity, campId: "", diners: base.diners_default,
      arrival: base.reception_weekday_default, catalog, history,
      seed: `${req.seed ?? `bulk-${Date.now()}`}-${attempt}`,
    });
    const results = camps.map((camp) => {
      const shiftDays = weekdayShift(base.reception_weekday_default, camp.reception_weekday_default);
      // El menú compartido se valida como una secuencia única respecto al día de recepción
      // del campamento base. Luego cada campamento recibe esa misma secuencia desplazada.
      const v = validateMenu({
        items: gen.items, catalog, parity, arrival: base.reception_weekday_default,
        year: req.year, week: req.week, campId: camp.id, diners: camp.diners_default, history,
      });
      return {
        campId: camp.id, campName: camp.name, diners: camp.diners_default,
        arrival: camp.reception_weekday_default, shiftDays, errors: v.metrics.errors,
        warnings: v.metrics.warnings, varietyScore: v.metrics.varietyScore,
      };
    });
    const errors = results.reduce((s, r) => s + r.errors, 0);
    const avgVariety = results.reduce((s, r) => s + r.varietyScore, 0) / results.length;
    const score = -errors * 10000 + avgVariety;
    if (!best || score > best.score) best = { gen, results, score };
    if (errors === 0 && avgVariety >= 75) break;
  }

  if (!best) throw new Error("No se pudo generar el menú bulk.");
  if (best.results.some((r) => r.errors > 0)) {
    throw new Error("No se encontró un menú base que cumpla las reglas para todos los campamentos seleccionados.");
  }
  const primary = camps[0];
  const primaryValidation = validateMenu({
    items: best.gen.items, catalog, parity, arrival: primary.reception_weekday_default,
    year: req.year, week: req.week, campId: primary.id, diners: primary.diners_default, history,
  });
  return {
    items: best.gen.items,
    seed: best.gen.seed,
    issues: primaryValidation.issues,
    metrics: primaryValidation.metrics,
    capacityWarning: best.results.some((r) => r.errors > 0)
      ? "No se encontró una combinación común sin errores para todos los campamentos seleccionados. Revise el detalle bulk antes de guardar."
      : null,
    campResults: best.results,
  };
}

export async function actionValidateBulk(req: { year: number; week: number; campIds: string[]; items: MenuItem[] }) {
  const repo = getRepo();
  const [catalog, history] = await Promise.all([repo.getCatalog(), repo.listMenus()]);
  const parity = parityOfWeek(req.week);
  const selectedCamps = req.campIds.map((id) => catalog.camps.find((c) => c.id === id)).filter((c): c is Camp => !!c && c.active);
  if (!selectedCamps.length) throw new Error("Seleccione al menos un campamento activo.");
  const base = selectedCamps[0];
  const results: BulkCampResult[] = [];
  for (const camp of selectedCamps) {
    const shiftDays = weekdayShift(base.reception_weekday_default, camp.reception_weekday_default);
    const v = validateMenu({ items: req.items, catalog, parity, arrival: base.reception_weekday_default, year: req.year, week: req.week, campId: camp.id, diners: camp.diners_default, history });
    results.push({ campId: camp.id, campName: camp.name, diners: camp.diners_default, arrival: camp.reception_weekday_default, shiftDays, errors: v.metrics.errors, warnings: v.metrics.warnings, varietyScore: v.metrics.varietyScore });
  }
  const primary = results[0];
  if (!primary) throw new Error("Seleccione al menos un campamento activo.");
  const validation = validateMenu({ items: req.items, catalog, parity, arrival: base.reception_weekday_default, year: req.year, week: req.week, campId: base.id, diners: base.diners_default, history });
  return { issues: validation.issues, metrics: validation.metrics, campResults: results };
}

export async function actionValidate(req: {
  items: MenuItem[]; year: number; week: number; campId: string; arrival: Weekday; diners?: number; scheduleShiftDays?: number;
}) {
  const repo = getRepo();
  const [catalog, history] = await Promise.all([repo.getCatalog(), repo.listMenus()]);
  const camp = catalog.camps.find((c) => c.id === req.campId);
  const shiftDays = req.scheduleShiftDays ?? 0;
  const normalizedItems = shiftDays ? shiftMenuItems(req.items, -shiftDays) : req.items;
  const normalizedArrival = shiftDays ? shiftWeekday(req.arrival, -shiftDays) : req.arrival;
  return validateMenu({
    items: normalizedItems, catalog, parity: parityOfWeek(req.week), arrival: normalizedArrival,
    year: req.year, week: req.week, campId: req.campId,
    diners: req.diners ?? camp?.diners_default ?? 100, history,
  });
}

export async function actionSaveMenu(menu: {
  id?: string; year: number; week: number; campId: string; diners: number; arrival: Weekday;
  items: MenuItem[]; status: MenuStatus; notes: string | null; seed: string | null;
  start: string | null; end: string | null; validationScore: number; varietyScore: number;
  allowRuleOverride?: boolean;
  scheduleShiftDays?: number;
}): Promise<string> {
  const repo = getRepo();
  const id = menu.id ?? newId("menu");
if (menu.status === "aprobado") {
    const [catalog, history] = await Promise.all([repo.getCatalog(), repo.listMenus()]);
    const shiftDays = menu.scheduleShiftDays ?? 0;
    const validation = validateMenu({
      items: shiftDays ? shiftMenuItems(menu.items, -shiftDays) : menu.items,
      catalog,
      parity: parityOfWeek(menu.week),
      arrival: shiftDays ? shiftWeekday(menu.arrival, -shiftDays) : menu.arrival,
      year: menu.year,
      week: menu.week,
      campId: menu.campId,
      diners: menu.diners,
      history: history.filter((m) => m.id !== menu.id),
    });
    if (validation.metrics.errors > 0 && !menu.allowRuleOverride)
      throw new Error(`El menú tiene ${validation.metrics.errors} alerta(s) de reglas. Revise el menú o use edición manual para aprobarlo bajo criterio del usuario.`);
  }
  const record: WeeklyMenu = {
    id, year: menu.year, week_number: menu.week, parity: parityOfWeek(menu.week), camp_id: menu.campId,
    diners: menu.diners, supply_arrival_weekday: menu.arrival, actual_start_date: menu.start,
    actual_end_date: menu.end, status: menu.status, validation_score: menu.validationScore,
    variety_score: menu.varietyScore, seed: menu.seed, notes: menu.notes,
    created_at: new Date().toISOString(),
    schedule_shift_days: menu.scheduleShiftDays ?? 0,
    items: menu.items.map((i) => ({ execution_status: "pending", replacement_name: null, ...i })),
  };
  await repo.saveMenu(record);
  revalidatePath("/menus"); revalidatePath("/");
  return id;
}

export async function actionSaveBulkMenus(req: {
  year: number; week: number; campIds: string[]; items: MenuItem[]; status: MenuStatus; seed: string | null;
  allowRuleOverride?: boolean;
}) {
  const repo = getRepo();
  const [catalog, history] = await Promise.all([repo.getCatalog(), repo.listMenus()]);
  const parity = parityOfWeek(req.week);
  const selectedCamps = req.campIds.map((id) => catalog.camps.find((c) => c.id === id)).filter((c): c is Camp => !!c && c.active);
  if (!selectedCamps.length) throw new Error("Seleccione al menos un campamento activo.");
  assertSameReceptionDay(selectedCamps);
  const saved: { campId: string; menuId: string }[] = [];
  const base = selectedCamps[0];
  for (const camp of selectedCamps) {
    const shiftDays = weekdayShift(base.reception_weekday_default, camp.reception_weekday_default);
    const shiftedItems = shiftMenuItems(req.items, shiftDays);
    const validation = validateMenu({
      items: req.items, catalog, parity, arrival: base.reception_weekday_default,
      year: req.year, week: req.week, campId: camp.id, diners: camp.diners_default, history,
    });
    if (req.status === "aprobado" && validation.metrics.errors > 0 && !req.allowRuleOverride)
      throw new Error(`${camp.name} tiene ${validation.metrics.errors} alerta(s) de reglas. Revise el menú o use edición manual para aprobarlo bajo criterio del usuario.`);
    const { start, end } = cycleDates(req.year, req.week, camp.reception_weekday_default);
    const menuId = newId("menu");
    await repo.saveMenu({
      id: menuId, year: req.year, week_number: req.week, parity, camp_id: camp.id,
      diners: camp.diners_default, supply_arrival_weekday: camp.reception_weekday_default,
      actual_start_date: start, actual_end_date: end, status: req.status,
      validation_score: validation.metrics.complianceScore, variety_score: validation.metrics.varietyScore,
      seed: req.seed,
      notes: `Menú compartido base ${base.name}; desplazamiento ${shiftDays} día(s) según recepción de víveres.`,
      created_at: new Date().toISOString(),
      schedule_shift_days: shiftDays,
      items: shiftedItems.map((i) => ({ ...i, execution_status: "pending", replacement_name: null })),
    });
    saved.push({ campId: camp.id, menuId });
  }
  revalidatePath("/menus"); revalidatePath("/");
  return saved;
}

export async function actionSetStatus(id: string, status: MenuStatus) {
  const repo = getRepo();
  if (status === "aprobado") {
    const [menu, catalog, history] = await Promise.all([repo.getMenu(id), repo.getCatalog(), repo.listMenus()]);
    if (!menu) throw new Error("Menú no encontrado.");
    if (menuStarted(menu)) throw new Error("La semana ya inició. El estado del menú está bloqueado.");
    const shiftDays = menu.schedule_shift_days ?? 0;
    const validation = validateMenu({
      items: shiftDays ? shiftMenuItems(menu.items, -shiftDays) : menu.items,
      catalog,
      parity: parityOfWeek(menu.week_number),
      arrival: shiftDays ? shiftWeekday(menu.supply_arrival_weekday, -shiftDays) : menu.supply_arrival_weekday,
      year: menu.year,
      week: menu.week_number,
      campId: menu.camp_id,
      diners: menu.diners,
      history: history.filter((m) => m.id !== menu.id),
    });
    if (validation.metrics.errors > 0)
      throw new Error(`El menú tiene ${validation.metrics.errors} error(es) críticos y no puede aprobarse.`);
  }
  await repo.setMenuStatus(id, status);
  revalidatePath("/menus"); revalidatePath(`/menus/${id}`); revalidatePath("/");
}

export async function actionDeleteMenu(id: string) {
  assertGeneralAdmin();
  const repo = getRepo();
  const menu = await repo.getMenu(id);
  if (!menu) return;
  if (menuStarted(menu)) throw new Error("No se puede eliminar un menú una vez iniciada su semana.");
  await repo.deleteMenu(id);
  revalidatePath("/menus"); revalidatePath("/");
}

export async function actionDuplicateMenu(id: string, year: number, week: number) {
  const repo = getRepo();
  const src = await repo.getMenu(id);
  if (!src) throw new Error("No se encontró el menú a duplicar.");
  const newIdValue = newId("menu");
  const { start, end } = cycleDates(year, week, src.supply_arrival_weekday);
  await repo.saveMenu({
    ...src, id: newIdValue, year, week_number: week, parity: parityOfWeek(week), status: "borrador",
    actual_start_date: start, actual_end_date: end, created_at: new Date().toISOString(),
    notes: `Duplicado de la semana ${src.week_number}. Revalide las reglas de la nueva semana.`,
    schedule_shift_days: 0,
    items: src.items.map((i) => ({ ...i, locked: false, execution_status: "pending", replacement_name: null })),
  });
  revalidatePath("/menus"); return newIdValue;
}

/* ------------------------------ seguimiento real ------------------------------ */
function ensureExecutionAdmin() { assertCanManageExecution(); }

export async function actionSetExecutionItem(req: {
  menuId: string; weekday: Weekday; service: "breakfast" | "lunch" | "dinner"; component: "main" | "soup";
  field?: "main" | "salad" | "beverage"; status: ExecutionStatus;
}) {
  ensureExecutionAdmin();
  const repo = getRepo();
  const menu = await repo.getMenu(req.menuId);
  if (!menu) throw new Error("Menú no encontrado.");
  const field = req.field ?? "main";
  menu.items = menu.items.map((i) => {
    if (i.weekday !== req.weekday || i.service !== req.service || i.component !== req.component) return i;
    if (field === "salad") return { ...i, salad_execution_status: req.status };
    if (field === "beverage") return { ...i, beverage_execution_status: req.status };
    return { ...i, execution_status: req.status, replacement_name: null };
  });
  await repo.saveMenu(menu);
  revalidatePath("/"); revalidatePath(`/menus/${req.menuId}`);
}

export async function actionMarkMenuExecution(menuId: string, status: Exclude<ExecutionStatus, "pending">) {
  ensureExecutionAdmin();
  const repo = getRepo();
  const menu = await repo.getMenu(menuId);
  if (!menu) throw new Error("Menú no encontrado.");
  menu.items = menu.items.map((i) => i.component === "main" ? { ...i, execution_status: status, replacement_name: status === "replaced" ? "Reemplazado" : null } : i);
  await repo.saveMenu(menu);
  revalidatePath("/"); revalidatePath(`/menus/${menuId}`);
}

/* ------------------------------ catálogo ------------------------------ */
export async function actionSaveRecipe(recipe: Recipe & { isNew?: boolean }) {
  const repo = getRepo();
  const id = recipe.isNew || !recipe.id ? uniqueId(slugify(recipe.name)) : recipe.id;
  const { isNew, ...rest } = recipe;
  await repo.upsertRecipe({ ...rest, id });
  revalidatePath("/preparaciones"); return id;
}
export async function actionSaveProtein(protein: Protein) { await getRepo().upsertProtein(protein); revalidatePath("/proteinas"); }
export async function actionSaveProduct(product: RestrictiveProduct & { isNew?: boolean }) {
  const repo = getRepo(); const id = product.isNew || !product.id ? uniqueId(slugify(product.name)) : product.id;
  const { isNew, ...rest } = product; await repo.upsertProduct({ ...rest, id }); revalidatePath("/productos");
}
export async function actionSaveCamp(camp: Camp & { isNew?: boolean }) {
  const repo = getRepo(); const id = camp.isNew || !camp.id ? uniqueId(slugify(camp.name)) : camp.id;
  const { isNew, ...rest } = camp; await repo.upsertCamp({ ...rest, id }); revalidatePath("/campamentos"); revalidatePath("/generar");
}

export async function actionDeleteCamp(id: string) {
  assertGeneralAdmin();
  const repo = getRepo();
  const menus = await repo.listMenus({ campId: id });
  if (menus.length) throw new Error("No se puede eliminar un campamento con menús históricos. Desactívelo para conservar trazabilidad.");
  await repo.deleteCamp(id);
  revalidatePath("/campamentos"); revalidatePath("/generar");
}

export async function actionSaveZone(zone: Zone & { isNew?: boolean }) {
  const repo = getRepo();
  const id = zone.isNew || !zone.id ? uniqueId(slugify(zone.name)) : zone.id;
  const { isNew, ...rest } = zone;
  await repo.upsertZone({ ...rest, id });
  revalidatePath("/campamentos"); revalidatePath("/generar"); revalidatePath("/");
  return id;
}

export async function actionDeleteZone(id: string) {
  assertGeneralAdmin();
  await getRepo().deleteZone(id);
  revalidatePath("/campamentos"); revalidatePath("/generar"); revalidatePath("/");
}

function shiftWeekday(day: Weekday, delta: number): Weekday {
  return (((day + delta) % 7 + 7) % 7) as Weekday;
}

function weekdayShift(baseArrival: Weekday, targetArrival: Weekday) {
  return ((targetArrival - baseArrival) % 7 + 7) % 7;
}

function shiftMenuItems(items: MenuItem[], delta: number): MenuItem[] {
  if (!delta) return items.map((i) => ({ ...i }));
  return items.map((i) => ({ ...i, weekday: shiftWeekday(i.weekday, delta) }));
}

function menuStarted(menu: WeeklyMenu) {
  if (!menu.actual_start_date) return false;
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  return ymd >= menu.actual_start_date;
}

function uniqueId(base: string) { return `${base || "item"}-${Math.random().toString(36).slice(2, 6)}`; }



