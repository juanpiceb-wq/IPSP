"use client";

import { WEEKDAYS } from "@/lib/types";
import type { Catalog, ExecutionStatus, MainService, MenuItem, Weekday } from "@/lib/types";

export type ExecutionField="main"|"salad"|"beverage";
export interface ExecutionRef{weekday:Weekday;service:MainService;component:"main"|"soup";field:ExecutionField;label:string;status:ExecutionStatus|undefined}

export default function ExecutionMenuTable({items,catalog,onSelect}:{items:MenuItem[];catalog:Catalog;onSelect?:(ref:ExecutionRef)=>void}){
  const recipeName=(id:string|null|undefined)=>id?catalog.recipes.find(r=>r.id===id)?.name??"—":"—";
  const get=(w:Weekday,s:MainService,c:"main"|"soup")=>items.find(i=>i.weekday===w&&i.service===s&&i.component===c);
  const statusOf=(i:MenuItem|undefined,field:ExecutionField)=>field==="salad"?i?.salad_execution_status:field==="beverage"?i?.beverage_execution_status:i?.execution_status;
  function Cell({w,s,c,field,label}:{w:Weekday;s:MainService;c:"main"|"soup";field:ExecutionField;label:string}){const i=get(w,s,c);const sunday=w===6&&c==="soup";const text=sunday?"No aplica":field==="main"?recipeName(i?.recipe_id):field==="salad"?"Ensalada a elección":(i?.beverage??"—");const st=statusOf(i,field);const clickable=!sunday&&!!i;return <td onClick={()=>clickable&&onSelect?.({weekday:w,service:s,component:c,field,label:text,status:st})} className={`exec-cell ${clickable?"cursor-pointer hover:bg-corp-100/70":""}`}><div className="flex min-h-[52px] flex-col justify-between gap-2"><span className={field==="beverage"?"text-xs italic text-corp-700":"text-sm text-ink"}>{text}</span>{!sunday&&clickable?<StatusBadge status={st}/>:null}</div></td>}
  return <div className="overflow-x-auto"><table className="w-full min-w-[1100px] border-collapse"><thead><tr><th className="th sticky left-0 z-20 w-36">Servicio</th>{WEEKDAYS.map(d=><th key={d.value} className="th text-center"><span className="block text-[11px] opacity-75">{d.short.toUpperCase()}</span><span>{d.label}</span></th>)}</tr></thead><tbody>
    <Section label="Desayuno"/><tr><Label>Plato fuerte</Label>{WEEKDAYS.map(d=><Cell key={d.value} w={d.value} s="breakfast" c="main" field="main" label="Plato fuerte"/>)}</tr><tr><Label muted>Bebida</Label>{WEEKDAYS.map(d=><Cell key={d.value} w={d.value} s="breakfast" c="main" field="beverage" label="Bebida"/>)}</tr>
    <Section label="Almuerzo"/><tr><Label>Sopa</Label>{WEEKDAYS.map(d=><Cell key={d.value} w={d.value} s="lunch" c="soup" field="main" label="Sopa"/>)}</tr><tr><Label>Plato fuerte</Label>{WEEKDAYS.map(d=><Cell key={d.value} w={d.value} s="lunch" c="main" field="main" label="Plato fuerte"/>)}</tr><tr><Label muted>Ensalada</Label>{WEEKDAYS.map(d=><Cell key={d.value} w={d.value} s="lunch" c="main" field="salad" label="Ensalada"/>)}</tr><tr><Label muted>Bebida</Label>{WEEKDAYS.map(d=><Cell key={d.value} w={d.value} s="lunch" c="main" field="beverage" label="Bebida"/>)}</tr>
    <Section label="Cena"/><tr><Label>Plato fuerte</Label>{WEEKDAYS.map(d=><Cell key={d.value} w={d.value} s="dinner" c="main" field="main" label="Plato fuerte"/>)}</tr><tr><Label muted>Ensalada</Label>{WEEKDAYS.map(d=><Cell key={d.value} w={d.value} s="dinner" c="main" field="salad" label="Ensalada"/>)}</tr><tr><Label muted>Bebida</Label>{WEEKDAYS.map(d=><Cell key={d.value} w={d.value} s="dinner" c="main" field="beverage" label="Bebida"/>)}</tr>
  </tbody></table><p className="mt-2 text-xs text-muted">Clic en cada componente para marcar Cumple o No cumple. Domingo: sopa no aplica.</p></div>
}
function StatusBadge({status}:{status:ExecutionStatus|undefined}){const ok=status==="complies"||status==="as_planned";const bad=status==="not_complies"||status==="replaced";return <span className={`exec-badge ${ok?"exec-ok":bad?"exec-bad":"exec-pending"}`}>{ok?"Cumple":bad?"No cumple":"Pendiente"}</span>}
function Section({label}:{label:string}){return <tr><td colSpan={8} className="bg-navy-700 px-3 py-1.5 text-xs font-semibold uppercase tracking-[.12em] text-white">{label}</td></tr>}
function Label({children,muted}:{children:React.ReactNode;muted?:boolean}){return <td className={`sticky left-0 z-10 border-b border-r border-line bg-white px-3 py-2 text-xs font-semibold ${muted?"text-muted":"text-navy-800"}`}>{children}</td>}

