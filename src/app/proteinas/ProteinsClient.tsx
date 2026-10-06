"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { actionSaveProtein } from "@/app/actions";
import { ORIGIN_LABEL } from "@/lib/types";
import type { AnimalOrigin, Protein } from "@/lib/types";

const ORIGINS:AnimalOrigin[]=["cerdo","res","pollo","pescado","marisco","huevo","otro"];

export default function ProteinsClient({proteins}:{proteins:Protein[]}){
  const router=useRouter();const [editing,setEditing]=useState<Protein|null>(null);const [saving,setSaving]=useState(false);
  const totals=useMemo(()=>({
    par:proteins.filter(p=>p.active&&!p.soup_only&&p.target_frequency>0&&(p.parity==="todas"||p.parity==="par")).reduce((s,p)=>s+p.target_frequency,0),
    impar:proteins.filter(p=>p.active&&!p.soup_only&&p.target_frequency>0&&(p.parity==="todas"||p.parity==="impar")).reduce((s,p)=>s+p.target_frequency,0),
  }),[proteins]);
  return <div className="space-y-4">
    <div className={`rounded-xl border px-4 py-3 text-sm ${totals.par===21&&totals.impar===21?"border-emerald-200 bg-emerald-50":"border-red-200 bg-red-50"}`}>
      <strong>Control de cuotas:</strong> semana par {totals.par}/21 · semana impar {totals.impar}/21. Las frecuencias de platos fuertes deben sumar exactamente 21 en cada paridad.
    </div>
    <div className="card overflow-x-auto"><table className="w-full min-w-[900px]"><thead><tr><th className="th">Proteína</th><th className="th">Origen</th><th className="th">Uso</th><th className="th">Semana</th><th className="th">Frecuencia exacta</th><th className="th">Rendimiento informativo</th><th className="th">Activa</th><th className="th"></th></tr></thead><tbody>{proteins.map(p=><tr key={p.id} className="hover:bg-corp-100/40"><td className="td font-semibold text-navy-800">{p.name}</td><td className="td">{ORIGIN_LABEL[p.origin]}</td><td className="td">{p.breakfast_only?<span className="badge bg-corp-100 text-corp-700">Solo desayuno</span>:p.soup_only?<span className="badge bg-navy-800 text-white">Solo sopa</span>:<span className="badge bg-slate-100 text-slate-600">Plato fuerte</span>}</td><td className="td">{p.parity==="todas"?"Todas":<span className="badge bg-amber-100 text-amber-800">{p.parity.toUpperCase()}</span>}</td><td className="td font-semibold">{p.target_frequency}</td><td className="td text-[12.5px] text-muted">{p.portion_label}</td><td className="td">{p.active?"Sí":"No"}</td><td className="td text-right"><button className="btn-ghost btn-sm" onClick={()=>setEditing({...p})}>Editar</button></td></tr>)}</tbody></table></div>
    <Modal open={!!editing} onClose={()=>setEditing(null)} title={`Editar ${editing?.name??""}`}>
      {editing?<div className="space-y-4"><div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre"><input className="input" value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/></Field>
        <Field label="Origen animal"><select className="input" value={editing.origin} onChange={e=>setEditing({...editing,origin:e.target.value as AnimalOrigin})}>{ORIGINS.map(o=><option key={o} value={o}>{ORIGIN_LABEL[o]}</option>)}</select></Field>
        <Field label="Frecuencia exacta semanal (comidas/semana)"><input type="number" min={0} className="input" value={editing.target_frequency} onChange={e=>setEditing({...editing,target_frequency:Number(e.target.value)})}/><p className="mt-1 text-[11px] text-muted">Cuando la proteína aplica a la paridad, debe aparecer exactamente este número de veces.</p></Field>
        <Field label="Semana disponible"><select className="input" value={editing.parity} onChange={e=>setEditing({...editing,parity:e.target.value as Protein["parity"]})}><option value="todas">Todas</option><option value="par">Solo par</option><option value="impar">Solo impar</option></select></Field>
        <Field label="Tipo de porción"><select className="input" value={editing.portion_type} onChange={e=>setEditing({...editing,portion_type:e.target.value as Protein["portion_type"]})}><option value="per_person">Cantidad por persona</option><option value="per_group">Personas que cubre 1 unidad</option><option value="none">Sin porción definida</option></select></Field>
        <Field label="Valor"><input type="number" step="0.1" className="input" value={editing.portion_value??""} onChange={e=>setEditing({...editing,portion_value:e.target.value===""?null:Number(e.target.value)})}/></Field>
        <Field label="Unidad"><input className="input" value={editing.portion_unit??""} onChange={e=>setEditing({...editing,portion_unit:e.target.value||null})}/></Field>
        <Field label="Texto de rendimiento"><input className="input" value={editing.portion_label} onChange={e=>setEditing({...editing,portion_label:e.target.value})}/></Field>
      </div><div className="flex flex-wrap gap-4"><Check label="Solo desayuno" checked={editing.breakfast_only} onChange={v=>setEditing({...editing,breakfast_only:v})}/><Check label="Solo sopa" checked={editing.soup_only} onChange={v=>setEditing({...editing,soup_only:v})}/><Check label="Activa" checked={editing.active} onChange={v=>setEditing({...editing,active:v})}/></div>
      <div className="flex justify-end gap-2 border-t border-line pt-3"><button className="btn-ghost" onClick={()=>setEditing(null)}>Cancelar</button><button className="btn-primary" disabled={saving} onClick={async()=>{setSaving(true);await actionSaveProtein(editing);setSaving(false);setEditing(null);router.refresh();}}>Guardar</button></div></div>:null}
    </Modal>
  </div>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <div><label className="label">{label}</label>{children}</div>}
function Check({label,checked,onChange}:{label:string;checked:boolean;onChange:(v:boolean)=>void}){return <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/>{label}</label>}
