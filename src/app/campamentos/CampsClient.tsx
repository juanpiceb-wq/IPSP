"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { actionDeleteCamp, actionDeleteZone, actionSaveCamp, actionSaveZone } from "@/app/actions";
import { WEEKDAYS } from "@/lib/types";
import type { Camp, Weekday, Zone } from "@/lib/types";

const EMPTY_CAMP: Camp & { isNew?: boolean } = {
  id: "", name: "", diners_default: 100, reception_weekday_default: 1,
  delivery_notes: null, notes: null, zone_id: null, active: true,
};
const EMPTY_ZONE: Zone & { isNew?: boolean } = { id: "", name: "", notes: null, active: true };

export default function CampsClient({ camps, zones, generalAdmin }: { camps: Camp[]; zones: Zone[]; generalAdmin: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<(Camp & { isNew?: boolean }) | null>(null);
  const [zoneEditing, setZoneEditing] = useState<(Zone & { isNew?: boolean }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return <div className="space-y-6">
    {error ? <div className="notice-error">{error}</div> : null}

    <section className="surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-base font-semibold text-navy-900">Zonas</h2><p className="text-sm text-muted">Agrupe campamentos que comparten una misma administración y menú base.</p></div>
        <button className="btn-ghost" onClick={() => setZoneEditing({ ...EMPTY_ZONE, isNew: true })}>+ Nueva zona</button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {zones.filter(z=>z.active).map(z => {
          const count = camps.filter(c => c.zone_id === z.id && c.active).length;
          return <div key={z.id} className="rounded-xl border border-line bg-white p-4">
            <div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-navy-900">{z.name}</div><div className="mt-1 text-xs text-muted">{count} campamento{count===1?"":"s"}</div></div><span className="chip-info">Zona</span></div>
            {z.notes ? <p className="mt-2 text-sm text-muted">{z.notes}</p> : null}
            <div className="mt-3 flex gap-2"><button className="btn-tertiary" onClick={()=>setZoneEditing({...z})}>Editar</button>{generalAdmin ? <button className="btn-danger-ghost" onClick={async()=>{ if(!confirm(`¿Eliminar la zona ${z.name}? Los campamentos quedarán sin zona.`)) return; try{await actionDeleteZone(z.id); router.refresh();}catch(e){setError(e instanceof Error?e.message:"No se pudo eliminar la zona.");}}}>Eliminar</button>:null}</div>
          </div>;
        })}
        {!zones.length ? <div className="rounded-xl border border-dashed border-line p-5 text-sm text-muted">Todavía no hay zonas creadas.</div> : null}
      </div>
    </section>

    <section>
      <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-navy-900">Campamentos</h2><p className="text-sm text-muted">Comensales, recepción y zona se configuran aquí y luego se heredan automáticamente al generar.</p></div><button className="btn-primary" onClick={() => setEditing({ ...EMPTY_CAMP, isNew: true })}>+ Nuevo campamento</button></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {camps.map(c => <article key={c.id} className={`surface p-5 ${c.active?"":"opacity-55"}`}>
          <div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-semibold text-navy-900">{c.name}</h3><p className="mt-1 text-sm text-ink">{c.diners_default} comensales habituales</p></div>{c.zone_id ? <span className="chip-info">{zones.find(z=>z.id===c.zone_id)?.name ?? "Zona"}</span>:<span className="chip-muted">Sin zona</span>}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted"><div className="rounded-lg bg-shell px-3 py-2"><span className="block text-[10px] font-semibold uppercase tracking-wide">Recepción</span><strong className="text-navy-800">{WEEKDAYS[c.reception_weekday_default].label}</strong></div><div className="rounded-lg bg-shell px-3 py-2"><span className="block text-[10px] font-semibold uppercase tracking-wide">Estado</span><strong className="text-navy-800">{c.active?"Activo":"Inactivo"}</strong></div></div>
          {c.delivery_notes ? <p className="mt-3 text-xs text-corp-700">{c.delivery_notes}</p>:null}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3"><button className="btn-tertiary" onClick={()=>setEditing({...c})}>Editar</button><button className="btn-tertiary" onClick={async()=>{await actionSaveCamp({...c,active:!c.active});router.refresh();}}>{c.active?"Desactivar":"Activar"}</button>{generalAdmin ? <button className="btn-danger-ghost" onClick={async()=>{if(!confirm(`¿Eliminar definitivamente ${c.name}?`)) return; try{await actionDeleteCamp(c.id);router.refresh();}catch(e){setError(e instanceof Error?e.message:"No se pudo eliminar.");}}}>Eliminar</button>:null}</div>
        </article>)}
      </div>
    </section>

    <Modal open={!!editing} onClose={()=>setEditing(null)} title={editing?.isNew?"Nuevo campamento":"Editar campamento"}>
      {editing ? <div className="space-y-4">
        <div><label className="label">Nombre</label><input className="input" value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/></div>
        <div className="grid gap-4 md:grid-cols-2"><div><label className="label">Comensales habituales</label><input className="input" type="number" min={1} value={editing.diners_default} onChange={e=>setEditing({...editing,diners_default:Number(e.target.value)})}/></div><div><label className="label">Recepción principal</label><select className="input" value={editing.reception_weekday_default} onChange={e=>setEditing({...editing,reception_weekday_default:Number(e.target.value) as Weekday})}>{WEEKDAYS.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}</select></div></div>
        <div><label className="label">Zona</label><select className="input" value={editing.zone_id ?? ""} onChange={e=>setEditing({...editing,zone_id:e.target.value||null})}><option value="">Sin zona</option>{zones.filter(z=>z.active).map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select></div>
        <div><label className="label">Detalles de entrega</label><textarea className="input" rows={2} value={editing.delivery_notes??""} onChange={e=>setEditing({...editing,delivery_notes:e.target.value||null})}/></div>
        <div><label className="label">Observaciones</label><textarea className="input" rows={2} value={editing.notes??""} onChange={e=>setEditing({...editing,notes:e.target.value||null})}/></div>
        <div className="flex justify-end gap-2 border-t border-line pt-4"><button className="btn-ghost" onClick={()=>setEditing(null)}>Cancelar</button><button className="btn-primary" disabled={saving||!editing.name.trim()} onClick={async()=>{setSaving(true);await actionSaveCamp(editing);setSaving(false);setEditing(null);router.refresh();}}>Guardar</button></div>
      </div>:null}
    </Modal>

    <Modal open={!!zoneEditing} onClose={()=>setZoneEditing(null)} title={zoneEditing?.isNew?"Nueva zona":"Editar zona"}>
      {zoneEditing ? <div className="space-y-4"><div><label className="label">Nombre de zona</label><input className="input" value={zoneEditing.name} onChange={e=>setZoneEditing({...zoneEditing,name:e.target.value})}/></div><div><label className="label">Observaciones</label><textarea className="input" rows={3} value={zoneEditing.notes??""} onChange={e=>setZoneEditing({...zoneEditing,notes:e.target.value||null})}/></div><div className="flex justify-end gap-2 border-t border-line pt-4"><button className="btn-ghost" onClick={()=>setZoneEditing(null)}>Cancelar</button><button className="btn-primary" disabled={saving||!zoneEditing.name.trim()} onClick={async()=>{setSaving(true);await actionSaveZone(zoneEditing);setSaving(false);setZoneEditing(null);router.refresh();}}>Guardar</button></div></div>:null}
    </Modal>
  </div>;
}
