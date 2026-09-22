"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import MenuTable, { type CellRef } from "@/components/MenuTable";
import Modal from "@/components/Modal";
import RecipePicker from "@/components/RecipePicker";
import {
  actionGenerate,
  actionGenerateBulk,
  actionSaveBulkMenus,
  actionSaveMenu,
  actionValidate,
  actionValidateBulk,
} from "@/app/actions";
import { parityOfWeek } from "@/lib/rules";
import { cycleDates, formatDate } from "@/lib/dates";
import { exportMenuPdf } from "@/lib/exportMenuPdf";
import { exportMenuExcel } from "@/lib/exportMenuExcel";
import { WEEKDAYS } from "@/lib/types";
import type { BulkCampResult } from "@/app/actions";
import type { Catalog, MainService, MenuItem, MenuMetrics, MenuStatus, ValidationIssue, Weekday } from "@/lib/types";

interface Props { catalog: Catalog; lastUsed: Record<string,string>; defaults: { year:number; week:number; campId:string } }

export default function GeneratorClient({ catalog, lastUsed, defaults }: Props) {
  const router = useRouter();
  const [pending,startTransition] = useTransition();
  const [year,setYear] = useState(defaults.year);
  const [week,setWeek] = useState(defaults.week);
  const firstTarget = defaults.campId ? `camp:${defaults.campId}` : catalog.camps[0] ? `camp:${catalog.camps[0].id}` : "";
  const [target,setTarget] = useState(firstTarget);
  const [items,setItems] = useState<MenuItem[]>([]);
  const [issues,setIssues] = useState<ValidationIssue[]>([]);
  const [metrics,setMetrics] = useState<MenuMetrics|null>(null);
  const [capacityWarning,setCapacityWarning] = useState<string|null>(null);
  const [seed,setSeed] = useState<string|null>(null);
  const [cell,setCell] = useState<CellRef|null>(null);
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState<string|null>(null);
  const [bulkResults,setBulkResults] = useState<BulkCampResult[]>([]);

  const parity = parityOfWeek(week);
  const [targetType,targetId] = target.split(":") as ["camp"|"zone",string];
  const camp = targetType === "camp" ? catalog.camps.find(c=>c.id===targetId) : undefined;
  const zone = targetType === "zone" ? catalog.zones.find(z=>z.id===targetId) : undefined;
  const zoneCamps = zone ? catalog.camps.filter(c=>c.active && c.zone_id===zone.id) : [];
  const bulkMode = targetType === "zone";
  const campIds = bulkMode ? zoneCamps.map(c=>c.id) : camp ? [camp.id] : [];
  const arrival = (camp?.reception_weekday_default ?? zoneCamps[0]?.reception_weekday_default ?? 1) as Weekday;
  const diners = camp?.diners_default ?? zoneCamps[0]?.diners_default ?? 100;
  const dates = cycleDates(year,week,arrival);

  const usedRecipeIds = useMemo(()=>items.flatMap(i=>[i.recipe_id,i.salad_recipe_id].filter(Boolean) as string[]),[items]);
  const proteinUseCounts = useMemo(()=>{const x:Record<string,number>={};items.forEach(i=>{if(i.protein_id)x[i.protein_id]=(x[i.protein_id]??0)+1});return x;},[items]);

  function generate(keepLocked:boolean){
    setMessage(null);
    startTransition(async()=>{
      try{
        if(!targetId) throw new Error("Seleccione un campamento o una zona.");
        if(bulkMode){
          if(!campIds.length) throw new Error("La zona seleccionada no tiene campamentos activos.");
          const res=await actionGenerateBulk({year,week,campIds});
          setItems(res.items);setIssues(res.issues);setMetrics(res.metrics);setCapacityWarning(res.capacityWarning);setSeed(res.seed);setBulkResults(res.campResults);
        }else if(camp){
          const res=await actionGenerate({year,week,campId:camp.id,diners:camp.diners_default,arrival:camp.reception_weekday_default,locked:keepLocked?items.filter(i=>i.locked):[]});
          setItems(res.items);setIssues(res.issues);setMetrics(res.metrics);setCapacityWarning(res.capacityWarning);setSeed(res.seed);setBulkResults([]);
        }
      }catch(e){setMessage(e instanceof Error?e.message:"No se pudo generar el menú.");}
    });
  }

  function revalidate(next:MenuItem[]){
    setItems(next);
    startTransition(async()=>{
      if(bulkMode){const r=await actionValidateBulk({items:next,year,week,campIds});setIssues(r.issues);setMetrics(r.metrics);setBulkResults(r.campResults);}
      else if(camp){const r=await actionValidate({items:next,year,week,campId:camp.id,arrival:camp.reception_weekday_default,diners:camp.diners_default});setIssues(r.issues);setMetrics(r.metrics);}
    });
  }

  function toggleLock(weekday:Weekday,service:MainService,component:"main"|"soup"){
    setItems(prev=>prev.map(i=>i.weekday===weekday&&i.service===service&&i.component===component?{...i,locked:!i.locked}:i));
  }
  function pick(recipeId:string|null){
    if(!cell)return;
    const next=items.map(i=>{
      if(i.weekday!==cell.weekday||i.service!==cell.service||i.component!==cell.component)return i;
      if(cell.field==="salad")return {...i,salad_recipe_id:recipeId};
      const recipe=catalog.recipes.find(r=>r.id===recipeId);
      return {...i,recipe_id:recipeId,protein_id:recipe?.primary_protein_id??null,reasons:["Selección manual del administrador."]};
    });
    setCell(null);revalidate(next);
  }

  async function save(status:MenuStatus){
    if(!items.length)return;
    if((metrics?.errors??0)>0||bulkResults.some(r=>r.errors>0)){setMessage("Corrija los errores críticos antes de guardar como menú definitivo.");if(status==="aprobado")return;}
    setSaving(true);
    try{
      if(bulkMode){await actionSaveBulkMenus({year,week,campIds,items,status,seed});router.push("/menus");}
      else if(camp){const d=cycleDates(year,week,camp.reception_weekday_default);const id=await actionSaveMenu({year,week,campId:camp.id,diners:camp.diners_default,arrival:camp.reception_weekday_default,items,status,notes:null,seed,start:d.start,end:d.end,validationScore:metrics?.complianceScore??0,varietyScore:metrics?.varietyScore??0});router.push(`/menus/${id}`);}
    }catch(e){setMessage(e instanceof Error?e.message:"No se pudo guardar el menú.");}finally{setSaving(false);}
  }

  const exportBlocked=(metrics?.errors??0)>0||bulkResults.some(r=>r.errors>0);
  const errorIssues=issues.filter(i=>i.level==="error");
  const warnIssues=issues.filter(i=>i.level==="warn");
  const activeItem=cell?items.find(i=>i.weekday===cell.weekday&&i.service===cell.service&&i.component===cell.component):null;

  return <div className="space-y-4">
    <section className="surface no-print p-5">
      <div className="grid gap-4 md:grid-cols-[150px_150px_minmax(280px,1fr)_auto] md:items-end">
        <div><label className="label">Año</label><input type="number" className="input" value={year} onChange={e=>setYear(Number(e.target.value))}/></div>
        <div><label className="label">Semana</label><input type="number" min={1} max={53} className="input" value={week} onChange={e=>setWeek(Number(e.target.value))}/></div>
        <div><label className="label">Campamento o zona</label><select className="input" value={target} onChange={e=>{setTarget(e.target.value);setItems([]);setMessage(null)}}>
          <optgroup label="Campamentos">{catalog.camps.filter(c=>c.active).map(c=><option key={c.id} value={`camp:${c.id}`}>{c.name}</option>)}</optgroup>
          {catalog.zones.some(z=>z.active)?<optgroup label="Zonas">{catalog.zones.filter(z=>z.active).map(z=><option key={z.id} value={`zone:${z.id}`}>{z.name} · todos los campamentos</option>)}</optgroup>:null}
        </select></div>
        <button className="btn-primary h-[42px]" onClick={()=>generate(false)} disabled={pending||!targetId}>{pending?"Generando…":"Generar menú"}</button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-xs">
        <span className={`chip ${parity==="par"?"chip-dark":"chip-info"}`}>SEMANA {parity.toUpperCase()}</span>
        {camp?<><span className="chip-muted">{camp.diners_default} comensales</span><span className="chip-muted">Víveres: {WEEKDAYS[camp.reception_weekday_default].label}</span><span className="text-muted">Uso real: {formatDate(dates.start)} → {formatDate(dates.end)}</span></>:null}
        {zone?<><span className="chip-info">Zona: {zone.name}</span><span className="chip-muted">{zoneCamps.length} campamentos</span><span className="text-muted">Mismo menú base; cumplimiento independiente por cocina.</span></>:null}
        {items.length?<div className="ml-auto flex gap-2"><button className="btn-ghost btn-sm" onClick={()=>generate(false)} disabled={pending}>Otra opción</button>{!bulkMode?<button className="btn-ghost btn-sm" onClick={()=>generate(true)} disabled={pending}>Regenerar no bloqueados</button>:null}</div>:null}
      </div>
    </section>

    {message?<div className="notice-warn">{message}</div>:null}

    {items.length ? <>
      <section className={`no-print rounded-xl border px-4 py-3 ${errorIssues.length?"border-red-200 bg-red-50":"border-emerald-200 bg-emerald-50"}`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className={`status-dot ${errorIssues.length?"bg-red-500":"bg-emerald-500"}`}/>
          <div className="min-w-0 flex-1"><div className="font-semibold text-navy-900">{errorIssues.length?`${errorIssues.length} regla${errorIssues.length===1?"":"s"} requieren atención`:"Menú válido"}</div><div className="text-xs text-muted">{capacityWarning??(errorIssues.length?errorIssues[0]?.message:"21 platos fuertes · 6 sopas lunes-sábado · 10/14 ensaladas")}</div></div>
          {(errorIssues.length||warnIssues.length)?<details className="text-xs"><summary className="cursor-pointer font-semibold text-corp-700">Ver detalle</summary><div className="mt-2 max-w-2xl space-y-1">{[...errorIssues,...warnIssues].slice(0,12).map((i,n)=><div key={n}>{i.message}</div>)}</div></details>:null}
        </div>
      </section>

      <section className="surface p-4 print-full">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold text-navy-900">Semana {week} · {bulkMode?zone?.name:camp?.name}</h2><p className="text-xs text-muted">Clic en un plato para reemplazarlo. Use el candado para conservarlo al regenerar.</p></div>
          <div className="no-print flex flex-wrap gap-2"><button className="btn-ghost btn-sm" disabled={exportBlocked} onClick={()=>exportMenuPdf({items,catalog,week,parity,campId:camp?.id??"",campName:bulkMode?zone?.name:camp?.name,diners:bulkMode?zoneCamps.reduce((sum,c)=>sum+c.diners_default,0):(camp?.diners_default??0),dinersLabel:bulkMode?`${zoneCamps.length} campamentos`:undefined,start:bulkMode?null:dates.start,end:bulkMode?null:dates.end})}>PDF</button><button className="btn-ghost btn-sm" disabled={exportBlocked} onClick={()=>exportMenuExcel({items,catalog,year,week,campName:bulkMode?zone?.name??"Zona":camp?.name??"Campamento",diners:bulkMode?zoneCamps.reduce((sum,c)=>sum+c.diners_default,0):(camp?.diners_default??0),start:bulkMode?null:dates.start,end:bulkMode?null:dates.end})}>Excel</button></div>
        </div>
        <MenuTable items={items} catalog={catalog} editable onCell={setCell} onToggleLock={toggleLock}/>
        <div className="no-print mt-4 flex justify-end gap-2 border-t border-line pt-4"><button className="btn-ghost" onClick={()=>save("borrador")} disabled={saving}>Guardar borrador</button><button className="btn-primary" onClick={()=>save("aprobado")} disabled={saving||exportBlocked}>Guardar y aprobar</button></div>
      </section>
    </>:<section className="empty-state"><div className="empty-icon">+</div><h2>Genera la planificación de la semana</h2><p>Escoge un campamento o una zona. Los comensales, recepción y demás datos se toman automáticamente de su configuración.</p></section>}

    <Modal open={!!cell} onClose={()=>setCell(null)} wide title={cell?`${WEEKDAYS[cell.weekday].label} · ${cell.component==="soup"?"Sopa":cell.field==="salad"?"Ensalada":cell.service==="breakfast"?"Desayuno":cell.service==="lunch"?"Almuerzo":"Cena"}`:""} subtitle="Solo se muestran preparaciones válidas para este espacio.">
      {cell?<div className="space-y-4">{cell.field==="recipe"&&activeItem?.reasons?.length?<div className="rounded-xl bg-corp-100 p-3 text-xs text-navy-800"><strong>Selección actual</strong><ul className="mt-1 list-disc pl-5">{activeItem.reasons.map((r,i)=><li key={i}>{r}</li>)}</ul></div>:null}<RecipePicker catalog={catalog} service={cell.field==="salad"?"salad":cell.component==="soup"?"soup":cell.service} weekday={cell.weekday} parity={parity} arrival={arrival} currentId={cell.field==="salad"?activeItem?.salad_recipe_id??null:activeItem?.recipe_id??null} usedRecipeIds={usedRecipeIds} proteinUseCounts={proteinUseCounts} lastUsed={lastUsed} items={items} diners={diners} onPick={pick}/></div>:null}
    </Modal>
  </div>;
}
