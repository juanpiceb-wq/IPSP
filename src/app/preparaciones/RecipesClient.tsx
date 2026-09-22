"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { actionSaveRecipe } from "@/app/actions";
import { SERVICE_LABEL, WEEKDAYS } from "@/lib/types";
import type { Catalog, Difficulty, Recipe, Service, Weekday } from "@/lib/types";

const ALL_SERVICES: Service[] = ["breakfast", "lunch", "dinner", "soup", "salad"];
const COMMON_BASES = [
  "Sin base dominante", "Plátano verde", "Plátano maduro", "Papa", "Pasta / fideo",
  "Lenteja", "Fréjol / menestra", "Garbanzo", "Mote", "Yuca", "Choclo",
  "Harina de trigo", "Remolacha", "Arroz especial",
];

const EMPTY: Recipe = {
  id: "",
  name: "",
  primary_protein_id: null,
  services: ["lunch", "dinner"],
  restrictive_product_ids: [],
  active: true,
  source: "Creada en la aplicación",
  notes: null,
  base_ingredient: "Sin base dominante",
  difficulty: 1,
  cooking_method: "Mixto",
  double_fry: false,
  sunday_roast: false,
  base_qty_per_person: null,
  base_unit: null,
  protein_qty_per_person: null,
  protein_unit: null,
  rice_mode: "default",
  fixed_weekday: null,
  fixed_service: null,
  only_weekday: null,
};

export default function RecipesClient({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filterProtein, setFilterProtein] = useState("");
  const [filterService, setFilterService] = useState("");
  const [filterBase, setFilterBase] = useState("");
  const [filterParity, setFilterParity] = useState("");
  const [editing, setEditing] = useState<(Recipe & { isNew?: boolean }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bases = useMemo(() => {
    const set = new Set(COMMON_BASES);
    catalog.recipes.forEach((r) => { if (r.base_ingredient) set.add(r.base_ingredient); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [catalog.recipes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es");
    return catalog.recipes.filter((r) => {
      if (q && !`${r.name} ${r.base_ingredient ?? ""}`.toLocaleLowerCase("es").includes(q)) return false;
      if (filterProtein && r.primary_protein_id !== filterProtein) return false;
      if (filterService && !r.services.includes(filterService as Service)) return false;
      if (filterBase && r.base_ingredient !== filterBase) return false;
      if (filterParity) {
        const parities = r.restrictive_product_ids
          .map((id) => catalog.products.find((p) => p.id === id)?.parity)
          .filter(Boolean);
        if (filterParity === "todas" && parities.some((p) => p !== "todas")) return false;
        if (filterParity !== "todas" && !parities.includes(filterParity as "par" | "impar")) return false;
      }
      return true;
    }).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "es"));
  }, [catalog, query, filterProtein, filterService, filterBase, filterParity]);

  function toggleService(service: Service) {
    if (!editing) return;
    const on = editing.services.includes(service);
    let services = on ? editing.services.filter((x) => x !== service) : [...editing.services, service];
    if (editing.double_fry) services = ["dinner"];
    setEditing({ ...editing, services });
  }

  async function save() {
    if (!editing || !editing.name.trim()) return;
    if (!editing.services.length) { setError("Seleccione al menos un servicio permitido."); return; }
    if (editing.difficulty && (editing.difficulty < 1 || editing.difficulty > 3)) { setError("La dificultad debe ser 1, 2 o 3."); return; }
    setSaving(true); setError(null);
    try {
      const normalized: Recipe & { isNew?: boolean } = {
        ...editing,
        name: editing.name.trim(),
        services: editing.double_fry ? ["dinner"] : editing.services,
        difficulty: (editing.difficulty ?? 1) as Difficulty,
        base_ingredient: editing.base_ingredient || "Sin base dominante",
        source: editing.source || "Creada en la aplicación",
      };
      await actionSaveRecipe(normalized);
      setEditing(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la preparación.");
    } finally { setSaving(false); }
  }

  function duplicate(r: Recipe) {
    setEditing({
      ...r,
      id: "",
      name: `${r.name} (copia)`,
      source: "Duplicada en la aplicación",
      isNew: true,
    });
  }

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input className="input xl:col-span-2" placeholder="Buscar preparación…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="input" value={filterProtein} onChange={(e) => setFilterProtein(e.target.value)}>
            <option value="">Todas las proteínas</option>
            {catalog.proteins.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="input" value={filterService} onChange={(e) => setFilterService(e.target.value)}>
            <option value="">Todos los servicios</option>
            {ALL_SERVICES.map((s) => <option key={s} value={s}>{SERVICE_LABEL[s]}</option>)}
          </select>
          <select className="input" value={filterBase} onChange={(e) => setFilterBase(e.target.value)}>
            <option value="">Todos los ingredientes base</option>
            {bases.map((b) => <option key={b}>{b}</option>)}
          </select>
          <select className="input" value={filterParity} onChange={(e) => setFilterParity(e.target.value)}>
            <option value="">Todas las paridades</option><option value="par">PAR</option><option value="impar">IMPAR</option><option value="todas">Sin restrictivo de paridad</option>
          </select>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[12px] text-muted">{filtered.length} preparaciones · el randomizador solo usa las activas.</p>
          <button className="btn-primary" onClick={() => setEditing({ ...EMPTY, isNew: true })}>+ Nueva preparación</button>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((r) => {
          const protein = catalog.proteins.find((p) => p.id === r.primary_protein_id);
          const restrictives = r.restrictive_product_ids.map((id) => catalog.products.find((p) => p.id === id)?.name).filter(Boolean);
          return (
            <article key={r.id} className={`card p-4 ${r.active ? "" : "opacity-55"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-bold text-navy-800">{r.name}</h3>
                  <p className="mt-0.5 text-[12px] text-muted">{protein?.name ?? "Sin proteína animal"} · base: {r.base_ingredient ?? "Sin definir"}</p>
                </div>
                <div className="flex gap-1.5">
                  <span className="badge bg-slate-100 text-slate-700">D{r.difficulty ?? 1}</span>
                  {r.double_fry ? <span className="badge bg-amber-100 text-amber-800">Doble fritura</span> : null}
                  {r.sunday_roast ? <span className="badge bg-emerald-100 text-emerald-800">Asado domingo</span> : null}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.services.map((s) => <span key={s} className="badge bg-corp-100 text-corp-700">{SERVICE_LABEL[s]}</span>)}
                {restrictives.map((x) => <span key={x} className="badge bg-amber-50 text-amber-800">{x}</span>)}
                {r.only_weekday != null ? <span className="badge bg-slate-100 text-slate-700">Solo {WEEKDAYS[r.only_weekday].label}</span> : null}
              </div>
              <div className="mt-3 flex gap-2 border-t border-line pt-3">
                <button className="btn-ghost btn-sm" onClick={() => setEditing({ ...r })}>Editar</button>
                <button className="btn-ghost btn-sm" onClick={() => duplicate(r)}>Duplicar</button>
                <button className="btn-ghost btn-sm" onClick={async () => { await actionSaveRecipe({ ...r, active: !r.active }); router.refresh(); }}>{r.active ? "Desactivar" : "Activar"}</button>
              </div>
            </article>
          );
        })}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.isNew ? "Nueva preparación" : "Editar preparación"} subtitle="Configure solo los datos que necesita el motor para decidir cuándo puede usar el plato." wide>
        {editing ? (
          <div className="space-y-4">
            {error ? <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-800">{error}</div> : null}
            <div>
              <label className="label">Nombre del plato</label>
              <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="label">Proteína principal</label>
                <select className="input" value={editing.primary_protein_id ?? ""} onChange={(e) => setEditing({ ...editing, primary_protein_id: e.target.value || null })}>
                  <option value="">Sin proteína animal</option>
                  {catalog.proteins.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Ingrediente base dominante</label>
                <select className="input" value={editing.base_ingredient ?? "Sin base dominante"} onChange={(e) => setEditing({ ...editing, base_ingredient: e.target.value })}>
                  {bases.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Dificultad de elaboración</label>
                <select className="input" value={editing.difficulty ?? 1} onChange={(e) => setEditing({ ...editing, difficulty: Number(e.target.value) as Difficulty })}>
                  <option value={1}>1 · Simple</option><option value={2}>2 · Media</option><option value={3}>3 · Alta</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Servicio permitido</label>
              <div className="flex flex-wrap gap-2">
                {ALL_SERVICES.map((s) => {
                  const on = editing.services.includes(s);
                  return <button key={s} type="button" disabled={!!editing.double_fry && s !== "dinner"} onClick={() => toggleService(s)} className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold ${on ? "border-corp-600 bg-corp-600 text-white" : "border-line bg-white text-muted"} disabled:opacity-35`}>{SERVICE_LABEL[s]}</button>;
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="label">Método</label>
                <input className="input" value={editing.cooking_method ?? ""} onChange={(e) => setEditing({ ...editing, cooking_method: e.target.value || null })} placeholder="Asado, frito, guiso…" />
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px]">
                <input type="checkbox" checked={!!editing.double_fry} onChange={(e) => setEditing({ ...editing, double_fry: e.target.checked, services: e.target.checked ? ["dinner"] : editing.services })} />
                Doble fritura · solo cena
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px]">
                <input type="checkbox" checked={!!editing.sunday_roast} onChange={(e) => setEditing({ ...editing, sunday_roast: e.target.checked })} />
                Válido como asado de domingo
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="label">Restricción de día</label>
                <select className="input" value={editing.only_weekday ?? ""} onChange={(e) => setEditing({ ...editing, only_weekday: e.target.value === "" ? null : Number(e.target.value) as Weekday })}>
                  <option value="">Cualquier día</option>
                  {WEEKDAYS.map((d) => <option key={d.value} value={d.value}>Solo {d.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Arroz</label>
                <select className="input" value={editing.rice_mode ?? "default"} onChange={(e) => setEditing({ ...editing, rice_mode: e.target.value as Recipe["rice_mode"] })}>
                  <option value="default">Agregar arroz por default</option><option value="integrated">Arroz integrado en el plato</option>
                </select>
              </div>
              <div>
                <label className="label">Activa</label>
                <select className="input" value={editing.active ? "si" : "no"} onChange={(e) => setEditing({ ...editing, active: e.target.value === "si" })}>
                  <option value="si">Sí</option><option value="no">No</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Productos restrictivos</label>
              <div className="grid max-h-56 gap-1.5 overflow-auto rounded-lg border border-line p-2 sm:grid-cols-2 md:grid-cols-3">
                {catalog.products.map((p) => {
                  const on = editing.restrictive_product_ids.includes(p.id);
                  return <label key={p.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] ${on ? "border-corp-500 bg-corp-100" : "border-line bg-white"}`}>
                    <input type="checkbox" checked={on} onChange={() => setEditing({ ...editing, restrictive_product_ids: on ? editing.restrictive_product_ids.filter((x) => x !== p.id) : [...editing.restrictive_product_ids, p.id] })} />
                    <span className="flex-1">{p.name}</span>{p.parity !== "todas" ? <span className="badge bg-amber-100 text-amber-800">{p.parity.toUpperCase()}</span> : null}
                  </label>;
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Consumo ingrediente base / persona (opcional)</label>
                <div className="flex gap-2">
                  <input type="number" step="0.01" min="0" className="input" value={editing.base_qty_per_person ?? ""} onChange={(e) => setEditing({ ...editing, base_qty_per_person: e.target.value ? Number(e.target.value) : null })} />
                  <input className="input" placeholder="LB / UN / VERDE" value={editing.base_unit ?? ""} onChange={(e) => setEditing({ ...editing, base_unit: e.target.value || null })} />
                </div>
              </div>
              <div>
                <label className="label">Consumo proteína / persona (opcional)</label>
                <div className="flex gap-2">
                  <input type="number" step="0.01" min="0" className="input" value={editing.protein_qty_per_person ?? ""} onChange={(e) => setEditing({ ...editing, protein_qty_per_person: e.target.value ? Number(e.target.value) : null })} />
                  <input className="input" placeholder="LB / UN / LATA" value={editing.protein_unit ?? ""} onChange={(e) => setEditing({ ...editing, protein_unit: e.target.value || null })} />
                </div>
              </div>
            </div>

            <div>
              <label className="label">Observaciones</label>
              <textarea className="input" rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value || null })} />
            </div>

            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <button className="btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
