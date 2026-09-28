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
  const [scope,setScope] = useState<"camp"|"camps"|"zones">("camp");
  const [campId,setCampId] = useState(defaults.campId || catalog.camps[0]?.id || "");
  const [campIdsSelected,setCampIdsSelected] = useState<string[]>([]);
  const [zoneIds,setZoneIds] = useState<string[]>([]);
  const [items,setItems] = useState<MenuItem[]>([]);
  const [issues,setIssues] = useState<ValidationIssue[]>([]);
  const [metrics,setMetrics] = useState<MenuMetrics|null>(null);
  const [capacityWarning,setCapacityWarning] = useState<string|null>(null);
  const [seed,setSeed] = useState<string|null>(null);
  const [cell,setCell] = useState<CellRef|null>(null);
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState<string|null>(null);
  const [bulkResults,setBulkResults] = useState<BulkCampResult[]>([]);
  const [manualOverride,setManualOverride] = useState(false);

  const parity = parityOfWeek(week);
  const activeCamps = catalog.camps.filter(c=>c.active);
  const camp = scope === "camp" ? activeCamps.find(c=>c.id===campId) : undefined;
  const activeZones = catalog.zones.filter(z=>z.active);
  const selectedZones = zoneIds.map(id=>activeZones.find(z=>z.id===id)).filter(Boolean) as typeof activeZones;
  const zoneCampMap = new Map(activeZones.map(z=>[z.id,activeCamps.filter(c=>c.zone_id===z.id)]));
  const selectedMultiCamps = campIdsSelected.map(id=>activeCamps.find(c=>c.id===id)).filter(Boolean) as typeof activeCamps;
  const zoneCamps = selectedZones.flatMap(z=>zoneCampMap.get(z.id) ?? []);
  const bulkMode = scope !== "camp";
  const bulkCamps = scope === "camps" ? selectedMultiCamps : zoneCamps;
  const campIds = bulkMode ? Array.from(new Set(bulkCamps.map(c=>c.id))) : camp ? [camp.id] : [];
  const baseCamp = bulkMode ? bulkCamps[0] : camp;
  const arrival = (baseCamp?.reception_weekday_default ?? 1) as Weekday;
  const diners = baseCamp?.diners_default ?? 100;
  const dates = cycleDates(year,week,arrival);
  const bulkLabel = scope === "camps" ? selectedMultiCamps.map(c=>c.name).join(" + ") : selectedZones.map(z=>z.name).join(" + ");

  const usedRecipeIds = useMemo(()=>items.flatMap(i=>[i.recipe_id,i.salad_recipe_id].filter(Boolean) as string[]),[items]);
  const proteinUseCounts = useMemo(()=>{const x:Record<string,number>={};items.forEach(i=>{if(i.protein_id)x[i.protein_id]=(x[i.protein_id]??0)+1});return x;},[items]);

  function generate(keepLocked:boolean){
    setMessage(null);
    startTransition(async()=>{
      try{
        if(scope==="camp" && !camp) throw new Error("Seleccione un campamento.");
        if(scope==="camps" && !campIdsSelected.length) throw new Error("Seleccione al menos un campamento.");
        if(scope==="zones" && !zoneIds.length) throw new Error("Seleccione al menos una zona.");
        if(bulkMode){
          if(!campIds.length) throw new Error("La selección no tiene campamentos activos.");
          const res=await actionGenerateBulk({year,week,campIds});
          setItems(res.items);setIssues(res.issues);setMetrics(res.metrics);setCapacityWarning(res.capacityWarning);setSeed(res.seed);setBulkResults(res.campResults);setManualOverride(false);
        }else if(camp){
          const res=await actionGenerate({year,week,campId:camp.id,diners:camp.diners_default,arrival:camp.reception_weekday_default,locked:keepLocked?items.filter(i=>i.locked):[]});
          setItems(res.items);setIssues(res.issues);setMetrics(res.metrics);setCapacityWarning(res.capacityWarning);setSeed(res.seed);setBulkResults([]);setManualOverride(false);
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
    setManualOverride(true);setCell(null);revalidate(next);
  }

  async function save(status:MenuStatus){
    if(!items.length)return;
    if((metrics?.errors??0)>0||bulkResults.some(r=>r.errors>0)){setMessage(manualOverride?"El menú tiene alertas de reglas, pero la edición manual puede guardarse y aprobarse.":"Corrija las alertas de reglas antes de aprobar, o realice una edición manual si desea asumir la excepción.");if(status==="aprobado"&&!manualOverride)return;}
    setSaving(true);
    try{
      if(bulkMode){await actionSaveBulkMenus({year,week,campIds,items,status,seed,allowRuleOverride:manualOverride});router.push("/menus");}
      else if(camp){const d=cycleDates(year,week,camp.reception_weekday_default);const id=await actionSaveMenu({year,week,campId:camp.id,diners:camp.diners_default,arrival:camp.reception_weekday_default,items,status,notes:null,seed,start:d.start,end:d.end,validationScore:metrics?.complianceScore??0,varietyScore:metrics?.varietyScore??0,allowRuleOverride:manualOverride});router.push(`/menus/${id}`);}
    }catch(e){setMessage(e instanceof Error?e.message:"No se pudo guardar el menú.");}finally{setSaving(false);}
  }

  const hasRuleAlerts=(metrics?.errors??0)>0||bulkResults.some(r=>r.errors>0);
  const exportBlocked=hasRuleAlerts&&!manualOverride;
  const errorIssues=issues.filter(i=>i.level==="error");
  const warnIssues=issues.filter(i=>i.level==="warn");
  const activeItem=cell?items.find(i=>i.weekday===cell.weekday&&i.service===cell.service&&i.component===cell.component):null;

  return <div className="space-y-4">
    <section className="surface no-print p-5">
      <div className="grid gap-4 md:grid-cols-[150px_150px_minmax(360px,1fr)_auto] md:items-end">
        <div><label className="label">Año</label><input type="number" className="input" value={year} onChange={e=>setYear(Number(e.target.value))}/></div>
        <div><label className="label">Semana</label><input type="number" min={1} max={53} className="input" value={week} onChange={e=>setWeek(Number(e.target.value))}/></div>
        <div className="space-y-2">
          <label className="label">Planificar para</label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`btn-ghost btn-sm ${scope==="camp"?"bg-corp-100":""}`} onClick={()=>{setScope("camp");setCampIdsSelected([]);setZoneIds([]);setItems([]);setMessage(null)}}>Un campamento</button>
            <button type="button" className={`btn-ghost btn-sm ${scope==="camps"?"bg-corp-100":""}`} onClick={()=>{setScope("camps");setZoneIds([]);setItems([]);setMessage(null)}}>Varios campamentos</button>
            <button type="button" className={`btn-ghost btn-sm ${scope==="zones"?"bg-corp-100":""}`} onClick={()=>{setScope("zones");setCampIdsSelected([]);setItems([]);setMessage(null)}}>Una o más zonas</button>
          </div>
          {scope==="camp"?
            <select className="input" value={campId} onChange={e=>{setCampId(e.target.value);setItems([]);setMessage(null)}}>
              {activeCamps.map(c=><option key={c.id} value={c.id}>{c.name} · víveres {WEEKDAYS[c.reception_weekday_default].label}</option>)}
            </select>
          :scope==="camps"?
            <div className="rounded-lg border border-line bg-white p-2">
              <div className="grid gap-1 sm:grid-cols-2">
                {activeCamps.map(campOption=>{
                  const selected=campIdsSelected.includes(campOption.id);
                  return <label key={campOption.id} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm">
                    <input type="checkbox" checked={selected} onChange={()=>{
                      setCampIdsSelected(prev=>selected?prev.filter(id=>id!==campOption.id):[...prev,campOption.id]);
                      setItems([]);setMessage(null);
                    }}/>
                    <span className="flex-1">{campOption.name}</span>
                    <span className="text-[11px] text-muted">{WEEKDAYS[campOption.reception_weekday_default].label}</span>
                  </label>;
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted">El primer campamento seleccionado define el menú base. Los demás se desplazan automáticamente según su día de recepción.</p>
            </div>
          :
            <div className="rounded-lg border border-line bg-white p-2">
              <div className="grid gap-1 sm:grid-cols-2">
                {activeZones.map(z=>{
                  const selected=zoneIds.includes(z.id);
                  const camps=zoneCampMap.get(z.id)??[];
                  const days=Array.from(new Set(camps.map(c=>c.reception_weekday_default))).map(d=>WEEKDAYS[d].short).join(", ");
                  return <label key={z.id} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm">
                    <input type="checkbox" checked={selected} onChange={()=>{
                      setZoneIds(prev=>selected?prev.filter(id=>id!==z.id):[...prev,z.id]);
                      setItems([]);setMessage(null);
                    }}/>
                    <span className="flex-1">{z.name}</span>
                    <span className="text-[11px] text-muted">{camps.length} camp. · {days||"sin recepción"}</span>
                  </label>;
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted">Puede combinar zonas aunque reciban víveres en días distintos. Cada campamento recibe el mismo menú desplazado a su calendario.</p>
            </div>
          }        </div>
        <button className="btn-primary h-[42px]" onClick={()=>generate(false)} disabled={pending||(scope==="camp"?!camp:scope==="camps"?!campIdsSelected.length:!zoneIds.length)}>{pending?"Generando…":"Generar menú"}</button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-xs">
        <span className={`chip ${parity==="par"?"chip-dark":"chip-info"}`}>SEMANA {parity.toUpperCase()}</span>
        {camp?<><span className="chip-muted">{camp.diners_default} comensales</span><span className="chip-muted">Víveres: {WEEKDAYS[camp.reception_weekday_default].label}</span><span className="text-muted">Uso real: {formatDate(dates.start)} → {formatDate(dates.end)}</span></>:null}
        {bulkMode&&bulkCamps.length?<><span className="chip-info">{scope==="camps"?"Campamentos":"Zonas"}: {bulkLabel}</span><span className="chip-muted">{bulkCamps.length} campamentos</span><span className="chip-muted">Base: {baseCamp?.name} · víveres {WEEKDAYS[arrival].label}</span><span className="text-muted">Misma secuencia; cada campamento se desplaza automáticamente según su recepción.</span></>:null}
        {items.length?<div className="ml-auto flex gap-2"><button className="btn-ghost btn-sm" onClick={()=>generate(false)} disabled={pending}>Otra opción</button>{!bulkMode?<button className="btn-ghost btn-sm" onClick={()=>generate(true)} disabled={pending}>Regenerar no bloqueados</button>:null}</div>:null}
      </div>
      {bulkMode&&bulkResults.length?<div className="mt-3 flex flex-wrap gap-2 text-[11px]">{bulkResults.map(r=><span key={r.campId} className="chip-muted">{r.campName}: {WEEKDAYS[r.arrival].label}{r.shiftDays?` · ${r.shiftDays>0?"+":""}${r.shiftDays} día${Math.abs(r.shiftDays)===1?"":"s"}`:" · base"}</span>)}</div>:null}
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
          <div><h2 className="text-lg font-semibold text-navy-900">Semana {week} · {bulkMode?bulkLabel:camp?.name}</h2><p className="text-xs text-muted">Clic en un plato para reemplazarlo. Use el candado para conservarlo al regenerar.</p></div>
          <div className="no-print flex flex-wrap gap-2"><button className="btn-ghost btn-sm" disabled={exportBlocked} onClick={()=>exportMenuPdf({items,catalog,week,parity,campId:camp?.id??"",campName:bulkMode?bulkLabel:camp?.name,diners:bulkMode?bulkCamps.reduce((sum,c)=>sum+c.diners_default,0):(camp?.diners_default??0),dinersLabel:bulkMode?`${bulkCamps.length} campamentos`:undefined,start:bulkMode?null:dates.start,end:bulkMode?null:dates.end})}>PDF</button><button className="btn-ghost btn-sm" disabled={exportBlocked} onClick={()=>exportMenuExcel({items,catalog,year,week,campName:bulkMode?bulkLabel||"Zonas":camp?.name??"Campamento",diners:bulkMode?bulkCamps.reduce((sum,c)=>sum+c.diners_default,0):(camp?.diners_default??0),start:bulkMode?null:dates.start,end:bulkMode?null:dates.end})}>Excel</button></div>
        </div>
        <MenuTable items={items} catalog={catalog} editable onCell={setCell} onToggleLock={toggleLock}/>
        <div className="no-print mt-4 flex justify-end gap-2 border-t border-line pt-4"><button className="btn-ghost" onClick={()=>save("borrador")} disabled={saving}>Guardar borrador</button><button className="btn-primary" onClick={()=>save("aprobado")} disabled={saving||exportBlocked}>Guardar y aprobar</button></div>
      </section>
    </>:<section className="empty-state"><div className="empty-icon">+</div><h2>Genera la planificación de la semana</h2><p>Escoge un campamento, varios campamentos o una o más zonas. Si reciben víveres en días distintos, el sistema desplaza automáticamente la misma secuencia de menú para cada campamento.</p></section>}

    <Modal open={!!cell} onClose={()=>setCell(null)} wide title={cell?`${WEEKDAYS[cell.weekday].label} · ${cell.component==="soup"?"Sopa":cell.field==="salad"?"Ensalada":cell.service==="breakfast"?"Desayuno":cell.service==="lunch"?"Almuerzo":"Cena"}`:""} subtitle="Solo se muestran preparaciones válidas para este espacio.">
      {cell?<div className="space-y-4">{cell.field==="recipe"&&activeItem?.reasons?.length?<div className="rounded-xl bg-corp-100 p-3 text-xs text-navy-800"><strong>Selección actual</strong><ul className="mt-1 list-disc pl-5">{activeItem.reasons.map((r,i)=><li key={i}>{r}</li>)}</ul></div>:null}<RecipePicker catalog={catalog} service={cell.field==="salad"?"salad":cell.component==="soup"?"soup":cell.service} weekday={cell.weekday} parity={parity} arrival={arrival} currentId={cell.field==="salad"?activeItem?.salad_recipe_id??null:activeItem?.recipe_id??null} usedRecipeIds={usedRecipeIds} proteinUseCounts={proteinUseCounts} lastUsed={lastUsed} items={items} diners={diners} onPick={pick}/></div>:null}
    </Modal>
  </div>;
}

