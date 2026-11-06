"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { actionDeleteCamp, actionDeleteMegazone, actionDeleteZone, actionSaveCamp, actionSaveMegazone, actionSaveZone } from "@/app/actions";
import { WEEKDAYS } from "@/lib/types";
import type { Camp, Megazone, Weekday, Zone } from "@/lib/types";

type Editable<T> = T & { isNew?: boolean };

const EMPTY_CAMP: Editable<Camp> = {
  id: "", name: "", diners_default: 100, reception_weekday_default: 1,
  delivery_notes: null, notes: null, zone_id: null, active: true,
};
const EMPTY_ZONE: Editable<Zone> = { id: "", name: "", notes: null, megazone_id: null, active: true };
const EMPTY_MEGAZONE: Editable<Megazone> = { id: "", name: "", color: "#dce3ea", manager: null, notes: null, sort_order: 0, active: true };
const NO_MEGA = "__none__";
const NO_ZONE = "__none__";

function swatch(color?: string | null) {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#dce3ea";
}

export default function CampsClient({ camps, zones, megazones, generalAdmin }: { camps: Camp[]; zones: Zone[]; megazones: Megazone[]; generalAdmin: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editable<Camp> | null>(null);
  const [zoneEditing, setZoneEditing] = useState<Editable<Zone> | null>(null);
  const [megaEditing, setMegaEditing] = useState<Editable<Megazone> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [megaFilter, setMegaFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<"all" | "active" | "inactive">("all");
  const [query, setQuery] = useState("");

  const activeMegas = useMemo(() => megazones.filter(m => m.active).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)), [megazones]);
  const megaById = useMemo(() => new Map(megazones.map(m => [m.id, m])), [megazones]);
  const activeZones = useMemo(() => zones.filter(z => z.active), [zones]);
  const zoneById = useMemo(() => new Map(zones.map(z => [z.id, z])), [zones]);
  const megaOfZone = (z: Zone | undefined) => (z?.megazone_id && megaById.has(z.megazone_id) ? z.megazone_id : NO_MEGA);

  /** Megazonas en orden del organigrama, más un grupo «Sin megazona» si hace falta. */
  const megaGroups = useMemo(() => {
    const groups: { id: string; mega: Megazone | null; zones: Zone[] }[] = activeMegas.map(m => ({ id: m.id, mega: m, zones: [] }));
    const loose: Zone[] = [];
    for (const z of [...activeZones].sort((a, b) => a.name.localeCompare(b.name))) {
      const g = groups.find(x => x.id === z.megazone_id);
      if (g) g.zones.push(z); else loose.push(z);
    }
    if (loose.length) groups.push({ id: NO_MEGA, mega: null, zones: loose });
    return groups;
  }, [activeMegas, activeZones]);

  const campsOfZone = (zoneId: string) => camps.filter(c => c.zone_id === zoneId);
  const campsOfMega = (megaId: string) => camps.filter(c => megaOfZone(c.zone_id ? zoneById.get(c.zone_id) : undefined) === megaId && !!c.zone_id);

  const visibleCamps = camps.filter(c => {
    if (stateFilter === "active" && !c.active) return false;
    if (stateFilter === "inactive" && c.active) return false;
    if (query.trim() && !c.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (megaFilter === "all") return true;
    const zone = c.zone_id ? zoneById.get(c.zone_id) : undefined;
    if (megaFilter === NO_ZONE) return !zone;
    return megaOfZone(zone) === megaFilter;
  });

  /** Campamentos visibles agrupados por zona, en el orden megazona → zona. */
  const campSections = (() => {
    const order: { key: string; title: string; mega: Megazone | null; camps: Camp[] }[] = [];
    for (const g of megaGroups) for (const z of g.zones) {
      const list = visibleCamps.filter(c => c.zone_id === z.id).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
      if (list.length) order.push({ key: z.id, title: z.name, mega: g.mega, camps: list });
    }
    const orphan = visibleCamps.filter(c => !c.zone_id || !activeZones.some(z => z.id === c.zone_id)).sort((a, b) => a.name.localeCompare(b.name));
    if (orphan.length) order.push({ key: NO_ZONE, title: "Sin zona", mega: null, camps: orphan });
    return order;
  })();

  const totals = { megas: activeMegas.length, zones: activeZones.length, camps: camps.length, active: camps.filter(c => c.active).length };

  async function run(task: () => Promise<unknown>, fallback: string) {
    setError(null);
    try { await task(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : fallback); }
  }

  return <div className="space-y-6">
    {error ? <div className="notice-error">{error}</div> : null}

    <div className="flex flex-wrap gap-2 text-xs">
      <span className="chip-info">{totals.megas} megazonas</span>
      <span className="chip-info">{totals.zones} zonas</span>
      <span className="chip-info">{totals.camps} campamentos</span>
      <span className="chip-muted">{totals.active} activos · {totals.camps - totals.active} inactivos</span>
    </div>

    <section className="surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-base font-semibold text-navy-900">Megazonas</h2><p className="text-sm text-muted">Estructura del organigrama de producción. Cada megazona tiene un Gerente Zonal y agrupa zonas.</p></div>
        <button className="btn-ghost" onClick={() => setMegaEditing({ ...EMPTY_MEGAZONE, sort_order: (activeMegas.at(-1)?.sort_order ?? 0) + 1, isNew: true })}>+ Nueva megazona</button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {activeMegas.map(m => {
          const zoneCount = activeZones.filter(z => z.megazone_id === m.id).length;
          const list = campsOfMega(m.id);
          const activeCount = list.filter(c => c.active).length;
          return <div key={m.id} className="rounded-xl border border-line bg-white p-4" style={{ borderLeft: `6px solid ${swatch(m.color)}` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><div className="font-semibold text-navy-900">{m.name}</div><div className="mt-1 text-xs text-muted">{zoneCount} zona{zoneCount === 1 ? "" : "s"} · {list.length} campamento{list.length === 1 ? "" : "s"} ({activeCount} activo{activeCount === 1 ? "" : "s"})</div></div>
              <span className="chip-muted">Megazona</span>
            </div>
            {m.manager ? <p className="mt-2 text-sm text-ink">{m.manager}</p> : null}
            {m.notes ? <p className="mt-1 text-xs text-muted">{m.notes}</p> : null}
            <div className="mt-3 flex gap-2"><button className="btn-tertiary" onClick={() => setMegaEditing({ ...m })}>Editar</button>{generalAdmin ? <button className="btn-danger-ghost" onClick={() => { if (!confirm(`¿Eliminar la megazona ${m.name}? Sus zonas quedarán sin megazona.`)) return; void run(() => actionDeleteMegazone(m.id), "No se pudo eliminar la megazona."); }}>Eliminar</button> : null}</div>
          </div>;
        })}
        {!activeMegas.length ? <div className="rounded-xl border border-dashed border-line p-5 text-sm text-muted">Todavía no hay megazonas creadas.</div> : null}
      </div>
    </section>

    <section className="surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-base font-semibold text-navy-900">Zonas</h2><p className="text-sm text-muted">Agrupe campamentos que comparten una misma administración y menú base.</p></div>
        <button className="btn-ghost" onClick={() => setZoneEditing({ ...EMPTY_ZONE, isNew: true })}>+ Nueva zona</button>
      </div>
      <div className="mt-4 space-y-5">
        {megaGroups.filter(g => g.zones.length).map(g => <div key={g.id}>
          <div className="mb-2 flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm border border-line" style={{ background: swatch(g.mega?.color) }}/><h3 className="text-sm font-semibold uppercase tracking-wide text-navy-800">{g.mega?.name ?? "Sin megazona"}</h3></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {g.zones.map(z => {
              const list = campsOfZone(z.id);
              const activeCount = list.filter(c => c.active).length;
              return <div key={z.id} className="rounded-xl border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-navy-900">{z.name}</div><div className="mt-1 text-xs text-muted">{list.length} campamento{list.length === 1 ? "" : "s"}{list.length ? ` · ${activeCount} activo${activeCount === 1 ? "" : "s"}` : ""}</div></div><span className="chip-info">Zona</span></div>
                {z.notes ? <p className="mt-2 text-sm text-muted">{z.notes}</p> : null}
                <div className="mt-3 flex gap-2"><button className="btn-tertiary" onClick={() => setZoneEditing({ ...z })}>Editar</button>{generalAdmin ? <button className="btn-danger-ghost" onClick={() => { if (!confirm(`¿Eliminar la zona ${z.name}? Los campamentos quedarán sin zona.`)) return; void run(() => actionDeleteZone(z.id), "No se pudo eliminar la zona."); }}>Eliminar</button> : null}</div>
              </div>;
            })}
          </div>
        </div>)}
        {!activeZones.length ? <div className="rounded-xl border border-dashed border-line p-5 text-sm text-muted">Todavía no hay zonas creadas.</div> : null}
      </div>
    </section>

    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-base font-semibold text-navy-900">Campamentos</h2><p className="text-sm text-muted">Comensales, recepción y zona se configuran aquí y luego se heredan automáticamente al generar. Solo los campamentos activos entran al generador.</p></div>
        <button className="btn-primary" onClick={() => setEditing({ ...EMPTY_CAMP, isNew: true })}>+ Nuevo campamento</button>
      </div>
      <div className="surface mb-4 grid gap-3 p-4 md:grid-cols-3">
        <div><label className="label">Megazona</label><select className="input" value={megaFilter} onChange={e => setMegaFilter(e.target.value)}><option value="all">Todas</option>{activeMegas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}<option value={NO_MEGA}>Sin megazona</option><option value={NO_ZONE}>Sin zona</option></select></div>
        <div><label className="label">Estado</label><select className="input" value={stateFilter} onChange={e => setStateFilter(e.target.value as typeof stateFilter)}><option value="all">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select></div>
        <div><label className="label">Buscar</label><input className="input" placeholder="Nombre del campamento" value={query} onChange={e => setQuery(e.target.value)}/></div>
      </div>
      <div className="space-y-6">
        {campSections.map(sec => <div key={sec.key}>
          <div className="mb-2 flex flex-wrap items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm border border-line" style={{ background: swatch(sec.mega?.color) }}/><h3 className="text-sm font-semibold text-navy-900">{sec.mega ? `${sec.mega.name} · ` : ""}{sec.title}</h3><span className="text-xs text-muted">{sec.camps.length} campamento{sec.camps.length === 1 ? "" : "s"}</span></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sec.camps.map(c => <article key={c.id} className={`surface p-5 ${c.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-3"><div><h4 className="text-base font-semibold text-navy-900">{c.name}</h4><p className="mt-1 text-sm text-ink">{c.diners_default} comensales habituales</p></div>{c.zone_id ? <span className="chip-info">{zoneById.get(c.zone_id)?.name ?? "Zona"}</span> : <span className="chip-muted">Sin zona</span>}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted"><div className="rounded-lg bg-shell px-3 py-2"><span className="block text-[10px] font-semibold uppercase tracking-wide">Recepción</span><strong className="text-navy-800">{WEEKDAYS[c.reception_weekday_default].label}</strong></div><div className="rounded-lg bg-shell px-3 py-2"><span className="block text-[10px] font-semibold uppercase tracking-wide">Estado</span><strong className="text-navy-800">{c.active ? "Activo" : "Inactivo"}</strong></div></div>
              {c.delivery_notes ? <p className="mt-3 text-xs text-corp-700">{c.delivery_notes}</p> : null}
              {c.notes ? <p className="mt-2 text-xs text-muted">{c.notes}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3"><button className="btn-tertiary" onClick={() => setEditing({ ...c })}>Editar</button><button className="btn-tertiary" onClick={() => void run(() => actionSaveCamp({ ...c, active: !c.active }), "No se pudo cambiar el estado.")}>{c.active ? "Desactivar" : "Activar"}</button>{generalAdmin ? <button className="btn-danger-ghost" onClick={() => { if (!confirm(`¿Eliminar definitivamente ${c.name}?`)) return; void run(() => actionDeleteCamp(c.id), "No se pudo eliminar."); }}>Eliminar</button> : null}</div>
            </article>)}
          </div>
        </div>)}
        {!campSections.length ? <div className="rounded-xl border border-dashed border-line p-5 text-sm text-muted">No hay campamentos con estos filtros.</div> : null}
      </div>
    </section>

    <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.isNew ? "Nuevo campamento" : "Editar campamento"}>
      {editing ? <div className="space-y-4">
        <div><label className="label">Nombre</label><input className="input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}/></div>
        <div className="grid gap-4 md:grid-cols-2"><div><label className="label">Comensales habituales</label><input className="input" type="number" min={1} value={editing.diners_default} onChange={e => setEditing({ ...editing, diners_default: Number(e.target.value) })}/></div><div><label className="label">Recepción principal</label><select className="input" value={editing.reception_weekday_default} onChange={e => setEditing({ ...editing, reception_weekday_default: Number(e.target.value) as Weekday })}>{WEEKDAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div></div>
        <div><label className="label">Zona</label><select className="input" value={editing.zone_id ?? ""} onChange={e => setEditing({ ...editing, zone_id: e.target.value || null })}><option value="">Sin zona</option>{megaGroups.filter(g => g.zones.length).map(g => <optgroup key={g.id} label={g.mega?.name ?? "Sin megazona"}>{g.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</optgroup>)}</select></div>
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })}/>Activo (entra al generador de menús)</label>
        <div><label className="label">Detalles de entrega</label><textarea className="input" rows={2} value={editing.delivery_notes ?? ""} onChange={e => setEditing({ ...editing, delivery_notes: e.target.value || null })}/></div>
        <div><label className="label">Observaciones</label><textarea className="input" rows={2} value={editing.notes ?? ""} onChange={e => setEditing({ ...editing, notes: e.target.value || null })}/></div>
        <div className="flex justify-end gap-2 border-t border-line pt-4"><button className="btn-ghost" onClick={() => setEditing(null)}>Cancelar</button><button className="btn-primary" disabled={saving || !editing.name.trim()} onClick={async () => { setSaving(true); await run(() => actionSaveCamp(editing), "No se pudo guardar el campamento."); setSaving(false); setEditing(null); }}>Guardar</button></div>
      </div> : null}
    </Modal>

    <Modal open={!!zoneEditing} onClose={() => setZoneEditing(null)} title={zoneEditing?.isNew ? "Nueva zona" : "Editar zona"}>
      {zoneEditing ? <div className="space-y-4">
        <div><label className="label">Nombre de zona</label><input className="input" value={zoneEditing.name} onChange={e => setZoneEditing({ ...zoneEditing, name: e.target.value })}/></div>
        <div><label className="label">Megazona</label><select className="input" value={zoneEditing.megazone_id ?? ""} onChange={e => setZoneEditing({ ...zoneEditing, megazone_id: e.target.value || null })}><option value="">Sin megazona</option>{activeMegas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
        <div><label className="label">Observaciones</label><textarea className="input" rows={3} value={zoneEditing.notes ?? ""} onChange={e => setZoneEditing({ ...zoneEditing, notes: e.target.value || null })}/></div>
        <div className="flex justify-end gap-2 border-t border-line pt-4"><button className="btn-ghost" onClick={() => setZoneEditing(null)}>Cancelar</button><button className="btn-primary" disabled={saving || !zoneEditing.name.trim()} onClick={async () => { setSaving(true); await run(() => actionSaveZone(zoneEditing), "No se pudo guardar la zona."); setSaving(false); setZoneEditing(null); }}>Guardar</button></div>
      </div> : null}
    </Modal>

    <Modal open={!!megaEditing} onClose={() => setMegaEditing(null)} title={megaEditing?.isNew ? "Nueva megazona" : "Editar megazona"}>
      {megaEditing ? <div className="space-y-4">
        <div><label className="label">Nombre de megazona</label><input className="input" value={megaEditing.name} onChange={e => setMegaEditing({ ...megaEditing, name: e.target.value })}/></div>
        <div><label className="label">Gerente zonal</label><input className="input" value={megaEditing.manager ?? ""} onChange={e => setMegaEditing({ ...megaEditing, manager: e.target.value || null })}/></div>
        <div className="grid gap-4 md:grid-cols-2"><div><label className="label">Color</label><div className="flex items-center gap-2"><input type="color" className="h-[42px] w-14 rounded-lg border border-line bg-white" value={swatch(megaEditing.color)} onChange={e => setMegaEditing({ ...megaEditing, color: e.target.value })}/><input className="input" value={megaEditing.color ?? ""} onChange={e => setMegaEditing({ ...megaEditing, color: e.target.value || null })}/></div></div><div><label className="label">Orden</label><input className="input" type="number" value={megaEditing.sort_order} onChange={e => setMegaEditing({ ...megaEditing, sort_order: Number(e.target.value) })}/></div></div>
        <div><label className="label">Observaciones</label><textarea className="input" rows={3} value={megaEditing.notes ?? ""} onChange={e => setMegaEditing({ ...megaEditing, notes: e.target.value || null })}/></div>
        <div className="flex justify-end gap-2 border-t border-line pt-4"><button className="btn-ghost" onClick={() => setMegaEditing(null)}>Cancelar</button><button className="btn-primary" disabled={saving || !megaEditing.name.trim()} onClick={async () => { setSaving(true); await run(() => actionSaveMegazone(megaEditing), "No se pudo guardar la megazona."); setSaving(false); setMegaEditing(null); }}>Guardar</button></div>
      </div> : null}
    </Modal>
  </div>;
}
