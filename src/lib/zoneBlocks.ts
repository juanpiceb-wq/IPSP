import { buildCalendarWeek, findPreviousMenu } from "./calendarWeek";
import type { WeekMenuSource } from "./calendarWeek";
import type { ComedorBlock } from "./exportComedorExcel";
import type { Catalog, WeeklyMenu } from "./types";

export type MenuLike = Pick<WeeklyMenu, "id" | "camp_id" | "year" | "week_number" | "supply_arrival_weekday" | "items">;

export function menuSource(m: MenuLike): WeekMenuSource {
  return { year: m.year, week: m.week_number, arrival: m.supply_arrival_weekday, items: m.items };
}

export function previousSource(all: MenuLike[], m: MenuLike): WeekMenuSource | null {
  const prev = findPreviousMenu(all, m.camp_id, m.year, m.week_number);
  return prev && prev.items.length ? menuSource(prev) : null;
}

/**
 * Agrupa los menús seleccionados en un bloque por zona y semana.
 * Los campamentos de una zona comparten menú: se usa el primero (por nombre) como
 * referencia y se avisa si otro campamento de la misma zona tiene un menú distinto.
 */
export function buildZoneBlocks(selected: MenuLike[], all: MenuLike[], catalog: Catalog): { blocks: ComedorBlock[]; warnings: string[] } {
  const campById = new Map(catalog.camps.map((c) => [c.id, c]));
  const zoneById = new Map(catalog.zones.map((z) => [z.id, z]));
  const groups = new Map<string, { zoneName: string; menus: MenuLike[] }>();
  for (const m of selected) {
    if (!m.items.length) continue;
    const camp = campById.get(m.camp_id);
    const zone = camp?.zone_id ? zoneById.get(camp.zone_id) : undefined;
    const zoneKey = zone ? zone.id : `camp:${m.camp_id}`;
    const zoneName = zone ? zone.name : `${camp?.name ?? m.camp_id} (sin zona)`;
    const key = `${m.year}|${String(m.week_number).padStart(2, "0")}|${zoneName}|${zoneKey}`;
    const g = groups.get(key) ?? { zoneName, menus: [] };
    g.menus.push(m);
    groups.set(key, g);
  }
  const blocks: ComedorBlock[] = [];
  const warnings: string[] = [];
  for (const key of [...groups.keys()].sort()) {
    const g = groups.get(key)!;
    const campName = (m: MenuLike) => campById.get(m.camp_id)?.name ?? m.camp_id;
    const menus = [...g.menus].sort((a, b) => campName(a).localeCompare(campName(b)));
    const ref = menus[0];
    const block: ComedorBlock = { zoneName: g.zoneName, current: menuSource(ref), previous: previousSource(all, ref) };
    blocks.push(block);
    const refSig = signature(block);
    for (const other of menus.slice(1)) {
      const sig = signature({ zoneName: g.zoneName, current: menuSource(other), previous: previousSource(all, other) });
      if (sig !== refSig)
        warnings.push(`${g.zoneName} · semana ${ref.week_number}: el menú de ${campName(other)} es distinto al de ${campName(ref)}. El Excel usa el de ${campName(ref)}.`);
    }
  }
  return { blocks, warnings };
}

function signature(block: ComedorBlock): string {
  return buildCalendarWeek(block.current, block.previous)
    .map((d) => d.items
      .map((i) => `${i.service}:${i.component}:${i.recipe_id ?? ""}:${i.salad_recipe_id ?? ""}`)
      .sort()
      .join(","))
    .join("|");
}
