"use server";

import { revalidatePath } from "next/cache";
import { actionGenerate, actionValidateBulk, type BulkCampResult, type GenerateRequest, type GenerateResponse } from "@/app/actions";
import { getRepo, newId } from "@/lib/db";
import { cycleDates } from "@/lib/dates";
import { validateMenu } from "@/lib/engine/validate";
import { parityOfWeek } from "@/lib/rules";
import type { Camp, MenuItem, MenuStatus, Weekday, WeeklyMenu } from "@/lib/types";

export async function actionGenerateShared(req: GenerateRequest): Promise<GenerateResponse> {
  const repo = getRepo();
  const [catalog, menus] = await Promise.all([repo.getCatalog(), repo.listMenus({ year: req.year })]);
  const template = selectWeekTemplate(menus, req.year, req.week);
  if (!template) return actionGenerate(req);

  const canonical = canonicalFromTemplate(template);
  const targetShift = weekdayShift(canonical.arrival, req.arrival);
  const items = shiftMenuItems(canonical.items, targetShift);
  const history = menus.filter((m) => !(m.year === req.year && m.week_number === req.week));
  const validation = validateMenu({
    items: canonical.items,
    catalog,
    parity: parityOfWeek(req.week),
    arrival: canonical.arrival,
    year: req.year,
    week: req.week,
    campId: req.campId,
    diners: req.diners,
    history,
  });
  const hard = validation.issues.filter((i) => i.level === "error");
  if (hard.length) throw new Error(`El menú maestro de la semana ${req.week} tiene ${hard.length} regla(s) crítica(s).`);
  const { start, end } = cycleDates(req.year, req.week, req.arrival);
  return {
    items,
    seed: template.seed ?? `shared-${req.year}-${req.week}`,
    issues: validation.issues,
    metrics: validation.metrics,
    capacityWarning: `Semana ${req.week}: se reutilizó el menú maestro ya creado.`,
    start,
    end,
  };
}

export async function actionGenerateBulkShared(req: { year: number; week: number; campIds: string[]; seed?: string }) {
  const repo = getRepo();
  const catalog = await repo.getCatalog();
  const camps = req.campIds.map((id) => catalog.camps.find((c) => c.id === id)).filter((c): c is Camp => !!c && c.active);
  if (!camps.length) throw new Error("Seleccione al menos un campamento activo.");
  const base = camps[0];
  const generated = await actionGenerateShared({
    year: req.year,
    week: req.week,
    campId: base.id,
    diners: base.diners_default,
    arrival: base.reception_weekday_default,
    seed: req.seed,
  });
  const checked = await actionValidateBulk({ year: req.year, week: req.week, campIds: req.campIds, items: generated.items });
  return { ...generated, issues: checked.issues, metrics: checked.metrics, campResults: checked.campResults };
}

interface SaveSharedInput {
  id?: string;
  year: number;
  week: number;
  campId: string;
  diners: number;
  arrival: Weekday;
  items: MenuItem[];
  status: MenuStatus;
  notes: string | null;
  seed: string | null;
  start: string | null;
  end: string | null;
  validationScore: number;
  varietyScore: number;
  scheduleShiftDays?: number;
}

export async function actionSaveSharedMenu(menu: SaveSharedInput): Promise<string> {
  const repo = getRepo();
  const [catalog, menus] = await Promise.all([repo.getCatalog(), repo.listMenus({ year: menu.year })]);
  const activeCamps = catalog.camps.filter((c) => c.active);
  if (!activeCamps.length) throw new Error("No hay campamentos activos.");

  const template = selectWeekTemplate(menus, menu.year, menu.week);
  const baseArrival = template ? canonicalFromTemplate(template).arrival : menu.arrival;
  const sourceShift = weekdayShift(baseArrival, menu.arrival);
  const canonicalItems = shiftMenuItems(menu.items, -sourceShift);
  const history = menus.filter((m) => !(m.year === menu.year && m.week_number === menu.week));
  let sourceId = menu.id ?? "";

  for (const camp of activeCamps) {
    const existing = menus.find((m) => m.year === menu.year && m.week_number === menu.week && m.camp_id === camp.id);
    if (existing && menuStarted(existing) && existing.id !== menu.id) continue;
    const shiftDays = weekdayShift(baseArrival, camp.reception_weekday_default);
    const shiftedItems = shiftMenuItems(canonicalItems, shiftDays);
    const validation = validateMenu({
      items: canonicalItems,
      catalog,
      parity: parityOfWeek(menu.week),
      arrival: baseArrival,
      year: menu.year,
      week: menu.week,
      campId: camp.id,
      diners: camp.diners_default,
      history,
    });
    if (menu.status === "aprobado" && validation.metrics.errors > 0) {
      throw new Error(`${camp.name} tiene ${validation.metrics.errors} error(es) de reglas.`);
    }
    const id = existing?.id ?? (camp.id === menu.campId && menu.id ? menu.id : newId("menu"));
    if (camp.id === menu.campId) sourceId = id;
    const { start, end } = cycleDates(menu.year, menu.week, camp.reception_weekday_default);
    await repo.saveMenu({
      id,
      year: menu.year,
      week_number: menu.week,
      parity: parityOfWeek(menu.week),
      camp_id: camp.id,
      diners: camp.diners_default,
      supply_arrival_weekday: camp.reception_weekday_default,
      actual_start_date: start,
      actual_end_date: end,
      status: menu.status,
      validation_score: validation.metrics.complianceScore,
      variety_score: validation.metrics.varietyScore,
      seed: menu.seed,
      notes: `Menú maestro semanal ${menu.year}-${menu.week}. Misma secuencia para todos los campamentos; solo cambia el calendario según recepción.`,
      created_at: existing?.created_at ?? new Date().toISOString(),
      schedule_shift_days: shiftDays,
      items: shiftedItems.map((i) => ({ ...i, execution_status: "pending", replacement_name: null, salad_execution_status: "pending", beverage_execution_status: "pending" })),
    });
  }

  revalidatePath("/menus");
  revalidatePath("/generar");
  revalidatePath("/");
  if (sourceId) revalidatePath(`/menus/${sourceId}`);
  return sourceId || newId("menu");
}

export async function actionSaveBulkSharedMenus(req: { year: number; week: number; campIds: string[]; items: MenuItem[]; status: MenuStatus; seed: string | null }) {
  const repo = getRepo();
  const catalog = await repo.getCatalog();
  const base = req.campIds.map((id) => catalog.camps.find((c) => c.id === id)).find((c): c is Camp => !!c && c.active);
  if (!base) throw new Error("Seleccione al menos un campamento activo.");
  const { start, end } = cycleDates(req.year, req.week, base.reception_weekday_default);
  const id = await actionSaveSharedMenu({
    year: req.year,
    week: req.week,
    campId: base.id,
    diners: base.diners_default,
    arrival: base.reception_weekday_default,
    items: req.items,
    status: req.status,
    notes: null,
    seed: req.seed,
    start,
    end,
    validationScore: 0,
    varietyScore: 0,
  });
  return [{ campId: base.id, menuId: id }];
}

function selectWeekTemplate(menus: WeeklyMenu[], year: number, week: number): WeeklyMenu | undefined {
  const matches = menus.filter((m) => m.year === year && m.week_number === week);
  return matches.find((m) => (m.schedule_shift_days ?? 0) === 0) ?? matches[0];
}

function canonicalFromTemplate(menu: WeeklyMenu) {
  const shift = menu.schedule_shift_days ?? 0;
  return { arrival: shiftWeekday(menu.supply_arrival_weekday, -shift), items: shiftMenuItems(menu.items, -shift) };
}

function shiftWeekday(day: Weekday, delta: number): Weekday {
  return (((day + delta) % 7 + 7) % 7) as Weekday;
}

function weekdayShift(baseArrival: Weekday, targetArrival: Weekday) {
  let delta = targetArrival - baseArrival;
  if (delta > 3) delta -= 7;
  if (delta < -3) delta += 7;
  return delta;
}

function shiftMenuItems(items: MenuItem[], delta: number): MenuItem[] {
  if (!delta) return items.map((i) => ({ ...i }));
  return items.map((i) => ({ ...i, weekday: shiftWeekday(i.weekday, delta) }));
}

function menuStarted(menu: WeeklyMenu) {
  if (!menu.actual_start_date) return false;
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return ymd >= menu.actual_start_date;
}
