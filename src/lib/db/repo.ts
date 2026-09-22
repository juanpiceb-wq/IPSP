import type {
  Camp,
  Catalog,
  Zone,
  MenuStatus,
  Protein,
  Recipe,
  RestrictiveProduct,
  WeeklyMenu,
} from "../types";

export interface MenuFilters {
  campId?: string;
  year?: number;
  status?: MenuStatus;
  limit?: number;
}

export interface Repo {
  readonly mode: "supabase" | "demo";
  getCatalog(): Promise<Catalog>;
  listMenus(filters?: MenuFilters): Promise<WeeklyMenu[]>;
  getMenu(id: string): Promise<WeeklyMenu | null>;
  saveMenu(menu: WeeklyMenu): Promise<string>;
  setMenuStatus(id: string, status: MenuStatus): Promise<void>;
  deleteMenu(id: string): Promise<void>;
  upsertRecipe(recipe: Recipe): Promise<void>;
  upsertProtein(protein: Protein): Promise<void>;
  upsertProduct(product: RestrictiveProduct): Promise<void>;
  upsertCamp(camp: Camp): Promise<void>;
  deleteCamp(id: string): Promise<void>;
  upsertZone(zone: Zone): Promise<void>;
  deleteZone(id: string): Promise<void>;
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
