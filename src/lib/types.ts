/** Tipos centrales del sistema de planificación de alimentación. */

/** 0 = Lunes … 6 = Domingo */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAYS: { value: Weekday; label: string; short: string }[] = [
  { value: 0, label: "Lunes", short: "Lun" },
  { value: 1, label: "Martes", short: "Mar" },
  { value: 2, label: "Miércoles", short: "Mié" },
  { value: 3, label: "Jueves", short: "Jue" },
  { value: 4, label: "Viernes", short: "Vie" },
  { value: 5, label: "Sábado", short: "Sáb" },
  { value: 6, label: "Domingo", short: "Dom" },
];

export type Service = "breakfast" | "lunch" | "dinner" | "soup" | "salad";
export type MainService = "breakfast" | "lunch" | "dinner";
export const MAIN_SERVICES: MainService[] = ["breakfast", "lunch", "dinner"];

export const SERVICE_LABEL: Record<Service, string> = {
  breakfast: "Desayuno",
  lunch: "Almuerzo",
  dinner: "Cena",
  soup: "Sopa",
  salad: "Ensalada",
};

export type Parity = "par" | "impar";
export type ProductParity = "todas" | "par" | "impar";
export type AnimalOrigin = "cerdo" | "res" | "pollo" | "pescado" | "marisco" | "huevo" | "otro";

export const ORIGIN_LABEL: Record<AnimalOrigin, string> = {
  cerdo: "Cerdo",
  res: "Res",
  pollo: "Pollo",
  pescado: "Pescado",
  marisco: "Marisco",
  huevo: "Huevo",
  otro: "Otro",
};

export type PortionType = "per_person" | "per_group" | "none";

export interface Protein {
  id: string;
  name: string;
  origin: AnimalOrigin;
  /** Proteínas que no pueden salir de desayuno: Atún y Huevo. */
  breakfast_only: boolean;
  soup_only: boolean;
  parity: ProductParity;
  /** MÁXIMO semanal, nunca una cuota obligatoria. */
  target_frequency: number;
  portion_type: PortionType;
  portion_value: number | null;
  portion_unit: string | null;
  portion_label: string;
  active: boolean;
  notes?: string | null;
}

export interface RestrictiveProduct {
  id: string;
  name: string;
  parity: ProductParity;
  category: string;
  arrival_weekday: Weekday | null;
  active: boolean;
  notes?: string | null;
}

export type RiceMode = "default" | "integrated";
export type Difficulty = 1 | 2 | 3;

export interface Recipe {
  id: string;
  name: string;
  primary_protein_id: string | null;
  services: Service[];
  restrictive_product_ids: string[];
  active: boolean;
  source: string;
  notes?: string | null;

  /** Campos operativos del maestro v2. Opcionales para mantener compatibilidad con ensaladas históricas. */
  base_ingredient?: string | null;
  difficulty?: Difficulty;
  cooking_method?: string | null;
  double_fry?: boolean;
  sunday_roast?: boolean;
  base_qty_per_person?: number | null;
  base_unit?: string | null;
  protein_qty_per_person?: number | null;
  protein_unit?: string | null;
  rice_mode?: RiceMode;
  fixed_weekday?: Weekday | null;
  fixed_service?: MainService | null;
  only_weekday?: Weekday | null;
}

export interface Zone {
  id: string;
  name: string;
  notes?: string | null;
  active: boolean;
}

export interface Camp {
  id: string;
  name: string;
  diners_default: number;
  reception_weekday_default: Weekday;
  /** Texto libre: horarios, segundo despacho, muelle, observaciones de recepción, etc. */
  delivery_notes?: string | null;
  notes?: string | null;
  zone_id?: string | null;
  active: boolean;
}

export type MenuStatus = "borrador" | "aprobado" | "utilizado";
export const STATUS_LABEL: Record<MenuStatus, string> = {
  borrador: "Borrador",
  aprobado: "Aprobado",
  utilizado: "Utilizado",
};

export type Component = "main" | "soup";
export type ExecutionStatus = "pending" | "complies" | "not_complies" | "as_planned" | "replaced";

export interface MenuItem {
  weekday: Weekday;
  service: MainService;
  component: Component;
  recipe_id: string | null;
  protein_id: string | null;
  salad_recipe_id: string | null;
  beverage: string | null;
  locked: boolean;
  reasons: string[];
  /** Seguimiento real para KPI de cumplimiento. */
  execution_status?: ExecutionStatus;
  replacement_name?: string | null;
  salad_execution_status?: ExecutionStatus;
  beverage_execution_status?: ExecutionStatus;
}

export interface WeeklyMenu {
  id: string;
  year: number;
  week_number: number;
  parity: Parity;
  camp_id: string;
  diners: number;
  supply_arrival_weekday: Weekday;
  actual_start_date: string | null;
  actual_end_date: string | null;
  status: MenuStatus;
  validation_score: number;
  variety_score: number;
  seed: string | null;
  notes: string | null;
  created_at: string;
  items: MenuItem[];
}

export interface MasterIngredient {
  id: string;
  name: string;
  group: string;
  restrictive: boolean;
  availability: ProductParity;
  use_in_menu: boolean;
  note: string | null;
}

export interface Catalog {
  proteins: Protein[];
  products: RestrictiveProduct[];
  recipes: Recipe[];
  camps: Camp[];
  zones: Zone[];
  ingredients: MasterIngredient[];
}

export type IssueLevel = "ok" | "warn" | "error";
export interface ValidationIssue {
  level: IssueLevel;
  rule: string;
  message: string;
  weekday?: Weekday;
  service?: MainService;
}

export interface MenuMetrics {
  mainCount: number;
  soupCount: number;
  saladCount: number;
  saladTarget: number;
  errors: number;
  warnings: number;
  varietyScore: number;
  complianceScore: number;
  porkExceptions: number;
  maxDailyDifficulty?: number;
  inventoryUsePct?: number;
}

export interface SupplyLimit {
  key: string;
  label: string;
  quantity_per_person: number;
  unit: string;
  notes?: string | null;
}
