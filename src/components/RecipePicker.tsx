"use client";

import { useMemo, useState } from "react";
import { blockingReason, buildContext, isMeaningfulBase, weeklyDishKey } from "@/lib/engine/context";
import { menuStockReason } from "@/lib/engine/validate";
import { RULES, cycleOrder } from "@/lib/rules";
import type { Catalog, MenuItem, Parity, Recipe, Service, Weekday } from "@/lib/types";

interface Props {
  catalog: Catalog;
  service: Service;
  weekday: Weekday;
  parity: Parity;
  arrival: Weekday;
  usedRecipeIds: string[];
  lastUsed: Record<string, string>;
  proteinUseCounts?: Record<string, number>;
  currentId: string | null;
  onPick: (recipeId: string | null) => void;
  allowEmpty?: boolean;
  items?: MenuItem[];
  diners?: number;
}

export default function RecipePicker({
  catalog, service, weekday, parity, arrival, usedRecipeIds, lastUsed,
  proteinUseCounts = {}, currentId, onPick, allowEmpty, items = [], diners = 100,
}: Props) {
  const [query, setQuery] = useState("");
  const [showInvalid, setShowInvalid] = useState(false);

  const ctx = useMemo(() => buildContext(catalog, parity, arrival, {
    recipeAgo: new Map(), recipeSlotAgo: new Map(), proteinAgo: new Map(), proteinSlotAgo: new Map(), baseAgo: new Map(), weeksAnalyzed: 0,
  }), [catalog, parity, arrival]);

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es");
    const currentRecipe = currentId ? catalog.recipes.find((x) => x.id === currentId) : null;
    const withoutCurrent = removeCurrent(items, currentId);

    return catalog.recipes
      .filter((r) => r.services.includes(service))
      .filter((r) => q ? `${r.name} ${r.base_ingredient ?? ""}`.toLocaleLowerCase("es").includes(q) : true)
      .map((r) => {
        const hard = blockingReason(r, service, weekday, ctx);
        const inWeek = usedRecipeIds.includes(r.id) && r.id !== currentId;
        const dishKey = weeklyDishKey(r.name);
        const familyInWeek = withoutCurrent.some((i) => {
          if (!i.recipe_id) return false;
          const used = catalog.recipes.find((x) => x.id === i.recipe_id);
          return !!used && weeklyDishKey(used.name) === dishKey;
        });
        const protein = r.primary_protein_id ? catalog.proteins.find((p) => p.id === r.primary_protein_id) : null;
        const currentProteinId = currentRecipe?.primary_protein_id ?? null;
        const used = protein ? proteinUseCounts[protein.id] ?? 0 : 0;
        const effectiveUses = protein && protein.id === currentProteinId ? Math.max(0, used - 1) : used;
        const maxReason = protein && protein.target_frequency > 0 && effectiveUses >= protein.target_frequency
          ? `${protein.name} ya alcanzó su máximo semanal de ${protein.target_frequency}.` : null;

        let dayReason: string | null = null;
        if (service !== "soup" && service !== "salad") {
          const sameDayMains = withoutCurrent.filter((i) => i.component === "main" && i.weekday === weekday);
          if (protein && sameDayMains.some((i) => i.protein_id === protein.id)) dayReason = `${protein.name} ya aparece en otro plato fuerte de ese día.`;
          if (!dayReason && protein) {
            const sameOrigin = protein.id !== "chorizo" && sameDayMains.some((i) => i.protein_id && i.protein_id !== "chorizo" && catalog.proteins.find((p) => p.id === i.protein_id)?.origin === protein.origin);
            // Repetir origen no-cerdo es una preferencia fuerte del generador, no una invalidez manual.
            if (sameOrigin && protein.origin === "cerdo") {
              const porkExceptionsUsed = [0,1,2,3,4,5,6].reduce((total, day) => {
                const n = withoutCurrent.filter((i) => i.component === "main" && i.weekday === day && i.protein_id && i.protein_id !== "chorizo" && catalog.proteins.find((p) => p.id === i.protein_id)?.origin === "cerdo").length;
                return total + Math.max(0, n - 1);
              }, 0);
              if (porkExceptionsUsed >= RULES.PORK_EXCEPTIONS_ALLOWED) dayReason = "Ya se utilizó la excepción semanal permitida para repetir origen cerdo.";
            }
          }
          if (!dayReason && protein) {
            const order = cycleOrder(arrival);
            const current = order.indexOf(weekday);
            const adjacent = withoutCurrent.some((i) => {
              if (!i.recipe_id || i.protein_id !== protein.id) return false;
              const other = order.indexOf(i.weekday);
              return other >= 0 && Math.abs(other - current) <= RULES.MIN_PROTEIN_GAP_DAYS;
            });
            if (adjacent) dayReason = `${protein.name} requiere al menos 1 día completo de por medio antes de repetirse.`;
          }
          const difficulty = sameDayMains.reduce((sum, i) => sum + (i.recipe_id ? catalog.recipes.find((x) => x.id === i.recipe_id)?.difficulty ?? 1 : 0), 0) + (r.difficulty ?? 1);
          if (!dayReason && difficulty > RULES.MAX_DAILY_DIFFICULTY) dayReason = `La dificultad diaria subiría a ${difficulty}; máximo ${RULES.MAX_DAILY_DIFFICULTY}.`;
          if (!dayReason && isMeaningfulBase(r.base_ingredient)) {
            const order = cycleOrder(arrival);
            const current = order.indexOf(weekday);
            const neighbor = withoutCurrent.find((i) => {
              if (i.component !== "main" || !i.recipe_id) return false;
              const other = order.indexOf(i.weekday);
              return other >= 0
                && Math.abs(other - current) === 1
                && catalog.recipes.find((x) => x.id === i.recipe_id)?.base_ingredient === r.base_ingredient;
            });
            if (neighbor) dayReason = `El ingrediente base ${r.base_ingredient} ya se usa en un día consecutivo del ciclo real.`;
          }
        }
        const stockReason = service === "salad" ? null : menuStockReason(withoutCurrent, { recipe_id: r.id }, catalog, diners);
        return { recipe: r, blocked: hard ?? maxReason ?? dayReason ?? stockReason ?? (familyInWeek ? "Ya existe un plato de esta misma familia en la semana." : null) ?? (inWeek ? "Ya está utilizada en esta semana." : null) };
      })
      .sort((a, b) => Number(!!a.blocked) - Number(!!b.blocked) || a.recipe.name.localeCompare(b.recipe.name, "es"));
  }, [catalog, service, query, weekday, ctx, usedRecipeIds, proteinUseCounts, currentId, items, diners, arrival]);

  const valid = rows.filter((r) => !r.blocked);
  const invalid = rows.filter((r) => r.blocked);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input flex-1" placeholder="Buscar preparación…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {allowEmpty ? <button type="button" className="btn-ghost" onClick={() => onPick(null)}>Sin ensalada</button> : null}
      </div>
      <p className="mt-3 text-[12px] text-muted">{valid.length} preparación(es) válida(s) para este espacio.</p>
      <ul className="mt-2 space-y-1.5">
        {valid.map(({ recipe }) => (
          <li key={recipe.id}>
            <button type="button" onClick={() => onPick(recipe.id)} className={`w-full rounded-lg border px-3 py-2 text-left transition hover:border-corp-500 hover:bg-corp-100 ${recipe.id === currentId ? "border-corp-600 bg-corp-100" : "border-line bg-white"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-navy-800">{recipe.name}</span>
                <span className="text-[11px] text-muted">{lastUsed[recipe.id] ? `Última vez: ${lastUsed[recipe.id]}` : "Sin uso reciente"}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <Tag>{proteinLabel(catalog, recipe)}</Tag>
                <Tag tone="muted">Base: {recipe.base_ingredient ?? "sin definir"}</Tag>
                <Tag tone="muted">D{recipe.difficulty ?? 1}</Tag>
                {recipe.restrictive_product_ids.length === 0 ? <Tag tone="muted">Sin restrictivos</Tag> : recipe.restrictive_product_ids.map((pid) => <Tag key={pid} tone="warn">{catalog.products.find((p) => p.id === pid)?.name ?? pid}</Tag>)}
              </div>
            </button>
          </li>
        ))}
      </ul>
      {invalid.length ? (
        <div className="mt-4">
          <button type="button" className="text-[12px] font-semibold text-corp-600 underline" onClick={() => setShowInvalid((v) => !v)}>{showInvalid ? "Ocultar" : "Ver"} {invalid.length} preparación(es) no disponible(s)</button>
          {showInvalid ? <ul className="mt-2 space-y-1">{invalid.map(({ recipe, blocked }) => <li key={recipe.id} className="rounded-lg border border-line bg-shell px-3 py-2 text-[12px] text-muted"><span className="font-semibold text-navy-800/70">{recipe.name}</span> — {blocked}</li>)}</ul> : null}
        </div>
      ) : null}
    </div>
  );
}

function removeCurrent(items: MenuItem[], currentId: string | null) {
  if (!currentId) return items;
  let removed = false;
  return items.filter((i) => {
    if (!removed && i.recipe_id === currentId) { removed = true; return false; }
    return true;
  });
}
function proteinLabel(catalog: Catalog, recipe: Recipe) {
  if (!recipe.primary_protein_id) return "Sin proteína animal";
  return catalog.proteins.find((p) => p.id === recipe.primary_protein_id)?.name ?? "—";
}
function Tag({ children, tone }: { children: React.ReactNode; tone?: "warn" | "muted" }) {
  const cls = tone === "warn" ? "bg-amber-100 text-amber-800" : tone === "muted" ? "bg-slate-100 text-slate-600" : "bg-corp-100 text-corp-700";
  return <span className={`badge ${cls}`}>{children}</span>;
}







