import type { Protein } from "./types";

export interface PortionCalc {
  proteinId: string;
  proteinName: string;
  uses: number;
  quantity: string;
  detail: string;
}

/** Cantidad estimada de una proteína para N comensales en UNA comida. */
export function estimateForMeal(protein: Protein, diners: number): string | null {
  if (protein.portion_type === "per_person" && protein.portion_value) {
    const total = protein.portion_value * diners;
    const unit = protein.portion_unit ?? "u";
    const rounded = Number.isInteger(total) ? total : Math.ceil(total * 100) / 100;
    return `${rounded} ${pluralize(unit, rounded)}`;
  }
  if (protein.portion_type === "per_group" && protein.portion_value) {
    const total = Math.ceil(diners / protein.portion_value);
    const unit = protein.portion_unit ?? "u";
    return `${total} ${pluralize(unit, total)}`;
  }
  return null;
}

function pluralize(unit: string, n: number): string {
  if (n === 1) return unit;
  if (unit.endsWith("s")) return unit;
  if (unit === "pollo") return "pollos";
  if (unit === "libra") return "libras";
  if (unit === "lata") return "latas";
  if (unit === "unidad") return "unidades";
  if (unit === "filete") return "filetes";
  if (unit === "huevo") return "huevos";
  return `${unit}s`;
}

/** Resumen de compras estimadas para todo el menú. */
export function estimateWeek(
  usesByProtein: Map<string, number>,
  proteins: Protein[],
  diners: number
): PortionCalc[] {
  const out: PortionCalc[] = [];
  for (const [proteinId, uses] of Array.from(usesByProtein.entries())) {
    const p = proteins.find((x) => x.id === proteinId);
    if (!p || uses === 0) continue;
    if (p.portion_type === "none" || !p.portion_value) {
      out.push({
        proteinId,
        proteinName: p.name,
        uses,
        quantity: "Sin porción definida",
        detail: p.portion_label,
      });
      continue;
    }
    if (p.portion_type === "per_person") {
      const total = p.portion_value * diners * uses;
      out.push({
        proteinId,
        proteinName: p.name,
        uses,
        quantity: `${Math.ceil(total * 100) / 100} ${pluralize(p.portion_unit ?? "u", total)}`,
        detail: `${p.portion_label} · ${uses} comida${uses > 1 ? "s" : ""}`,
      });
    } else {
      const total = Math.ceil(diners / p.portion_value) * uses;
      out.push({
        proteinId,
        proteinName: p.name,
        uses,
        quantity: `${total} ${pluralize(p.portion_unit ?? "u", total)}`,
        detail: `${p.portion_label} · ${uses} comida${uses > 1 ? "s" : ""}`,
      });
    }
  }
  return out.sort((a, b) => a.proteinName.localeCompare(b.proteinName));
}
