import { CAMPS, MASTER_INGREDIENTS, PRODUCTS, PROTEINS, RECIPES, historicalMenus } from "../seed/data";
import { currentProteinOverrides } from "../seed/currentOverrides";
import type {
  Camp,
  Catalog,
  Zone,
  MasterIngredient,
  MenuStatus,
  Protein,
  Recipe,
  RestrictiveProduct,
  WeeklyMenu,
} from "../types";
import type { MenuFilters, Repo } from "./repo";

interface Store {
  ingredients: MasterIngredient[];
  proteins: Protein[];
  products: RestrictiveProduct[];
  recipes: Recipe[];
  camps: Camp[];
  zones: Zone[];
  menus: WeeklyMenu[];
}

declare global {
  // eslint-disable-next-line no-var
  var __menuStore: Store | undefined;
}

function store(): Store {
  if (!globalThis.__menuStore) {
    globalThis.__menuStore = {
      ingredients: clone(MASTER_INGREDIENTS),
      proteins: clone(currentProteinOverrides(PROTEINS)),
      products: clone(PRODUCTS),
      recipes: clone(RECIPES),
      camps: clone(CAMPS),
      zones: [],
      menus: clone(historicalMenus()),
    };
  }
  return globalThis.__menuStore;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Almacén en memoria: permite probar la aplicación sin configurar Supabase. */
export class MemoryRepo implements Repo {
  readonly mode = "demo" as const;

  async getCatalog(): Promise<Catalog> {
    const s = store();
    return clone({
      proteins: s.proteins,
      products: s.products,
      recipes: s.recipes,
      camps: s.camps,
      zones: s.zones,
      ingredients: s.ingredients,
    });
  }

  async listMenus(filters: MenuFilters = {}): Promise<WeeklyMenu[]> {
    let list = clone(store().menus);
    if (filters.campId) list = list.filter((m) => m.camp_id === filters.campId);
    if (filters.year) list = list.filter((m) => m.year === filters.year);
    if (filters.status) list = list.filter((m) => m.status === filters.status);
    list.sort((a, b) =>
      b.year - a.year || b.week_number - a.week_number || b.created_at.localeCompare(a.created_at)
    );
    return filters.limit ? list.slice(0, filters.limit) : list;
  }

  async getMenu(id: string): Promise<WeeklyMenu | null> {
    return clone(store().menus.find((m) => m.id === id) ?? null);
  }

  async saveMenu(menu: WeeklyMenu): Promise<string> {
    const s = store();
    const idx = s.menus.findIndex((m) => m.id === menu.id);
    if (idx >= 0) s.menus[idx] = clone(menu);
    else s.menus.push(clone(menu));
    return menu.id;
  }

  async setMenuStatus(id: string, status: MenuStatus) {
    const m = store().menus.find((x) => x.id === id);
    if (m) m.status = status;
  }

  async deleteMenu(id: string) {
    const s = store();
    s.menus = s.menus.filter((m) => m.id !== id);
  }

  async upsertRecipe(recipe: Recipe) {
    const s = store();
    const i = s.recipes.findIndex((r) => r.id === recipe.id);
    if (i >= 0) s.recipes[i] = clone(recipe);
    else s.recipes.push(clone(recipe));
  }

  async upsertProtein(protein: Protein) {
    const s = store();
    const i = s.proteins.findIndex((r) => r.id === protein.id);
    if (i >= 0) s.proteins[i] = clone(protein);
    else s.proteins.push(clone(protein));
  }

  async upsertProduct(product: RestrictiveProduct) {
    const s = store();
    const i = s.products.findIndex((r) => r.id === product.id);
    if (i >= 0) s.products[i] = clone(product);
    else s.products.push(clone(product));
  }

  async upsertCamp(camp: Camp) {
    const s = store();
    const i = s.camps.findIndex((r) => r.id === camp.id);
    if (i >= 0) s.camps[i] = clone(camp);
    else s.camps.push(clone(camp));
  }

  async deleteCamp(id: string) {
    const s = store();
    s.camps = s.camps.filter((c) => c.id !== id);
  }

  async upsertZone(zone: Zone) {
    const s = store();
    const i = s.zones.findIndex((z) => z.id === zone.id);
    if (i >= 0) s.zones[i] = clone(zone);
    else s.zones.push(clone(zone));
  }

  async deleteZone(id: string) {
    const s = store();
    s.camps = s.camps.map((c) => c.zone_id === id ? { ...c, zone_id: null } : c);
    s.zones = s.zones.filter((z) => z.id !== id);
  }
}
