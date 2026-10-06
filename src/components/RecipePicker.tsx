"use client";

import { useMemo, useState } from "react";
import { blockingReason, buildContext, isMeaningfulBase } from "@/lib/engine/context";
import { menuStockReason } from "@/lib/engine/validate";
import { RULES, cycleOrder } from "@/lib/rules";
import type { Catalog, MainService, MenuItem, Parity, Recipe, Service, Weekday } from "@/lib/types";

interface Props {
  catalog:Catalog; service:Service; weekday:Weekday; parity:Parity; arrival:Weekday;
  usedRecipeIds:string[]; lastUsed:Record<string,string>; proteinUseCounts?:Record<string,number>;
  currentId:string|null; onPick:(recipeId:string|null)=>void; allowEmpty?:boolean; items?:MenuItem[]; diners?:number;
}

export default function RecipePicker({catalog,service,weekday,parity,arrival,usedRecipeIds,lastUsed,proteinUseCounts={},currentId,onPick,allowEmpty,items=[],diners=100}:Props){
  const [query,setQuery]=useState("");const [showInvalid,setShowInvalid]=useState(false);
  const ctx=useMemo(()=>buildContext(catalog,parity,arrival,{recipeAgo:new Map(),recipeSlotAgo:new Map(),proteinAgo:new Map(),proteinSlotAgo:new Map(),baseAgo:new Map(),weeksAnalyzed:0}),[catalog,parity,arrival]);

  const rows=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase("es");
    const currentRecipe=currentId?catalog.recipes.find(x=>x.id===currentId):null;
    const withoutCurrent=removeCurrent(items,currentId);
    return catalog.recipes.filter(r=>r.active)
      .filter(r=>service==="salad"?r.services.includes("salad"):service==="soup"?r.services.includes("soup"):!r.services.includes("soup")&&!r.services.includes("salad"))
      .filter(r=>q?`${r.name} ${r.base_ingredient??""}`.toLocaleLowerCase("es").includes(q):true)
      .map(r=>{
        const hard=blockingReason(r,service,weekday,ctx);
        const inWeek=usedRecipeIds.includes(r.id)&&r.id!==currentId;
        const protein=r.primary_protein_id?catalog.proteins.find(p=>p.id===r.primary_protein_id):null;
        const currentProtein=currentRecipe?.primary_protein_id??null;
        const used=protein?proteinUseCounts[protein.id]??0:0;
        const effectiveUses=protein&&protein.id===currentProtein?Math.max(0,used-1):used;
        const quotaReason=protein&&protein.target_frequency>0&&effectiveUses>=protein.target_frequency
          ?`${protein.name} ya tiene completa su frecuencia exacta semanal de ${protein.target_frequency}.`:null;

        let dayReason:string|null=null;
        if(service!=="soup"&&service!=="salad"){
          const dayMains=withoutCurrent.filter(i=>i.component==="main"&&i.weekday===weekday);
          if(protein&&dayMains.some(i=>i.protein_id===protein.id))dayReason=`${protein.name} ya aparece en otro plato fuerte de ese día.`;
          if(!dayReason&&protein&&protein.id!=="chorizo"){
            const sameOrigin=dayMains.some(i=>i.protein_id&&i.protein_id!=="chorizo"&&catalog.proteins.find(p=>p.id===i.protein_id)?.origin===protein.origin);
            if(sameOrigin&&protein.origin!=="cerdo")dayReason=`El origen ${protein.origin} ya aparece en otro plato fuerte de ese día.`;
            if(sameOrigin&&protein.origin==="cerdo"&&porkExceptions(withoutCurrent,catalog)>=RULES.PORK_EXCEPTIONS_ALLOWED)dayReason="Ya se utilizó la única excepción semanal permitida para repetir origen cerdo.";
          }
          if(!dayReason&&protein&&protein.id!=="huevo"){
            const order=cycleOrder(arrival);const pos=order.indexOf(weekday);
            const adjacent=withoutCurrent.some(i=>i.component==="main"&&i.recipe_id&&i.protein_id===protein.id&&Math.abs(order.indexOf(i.weekday)-pos)<=RULES.MIN_PROTEIN_GAP_DAYS);
            if(adjacent)dayReason=`${protein.name} requiere al menos 1 día completo de por medio antes de repetirse.`;
          }
          const difficulty=dayMains.reduce((s,i)=>s+(i.recipe_id?catalog.recipes.find(x=>x.id===i.recipe_id)?.difficulty??1:0),0)+(r.difficulty??1);
          if(!dayReason&&difficulty>RULES.MAX_DAILY_DIFFICULTY)dayReason=`La dificultad diaria subiría a ${difficulty}; máximo ${RULES.MAX_DAILY_DIFFICULTY}.`;
          if(!dayReason&&isMeaningfulBase(r.base_ingredient)&&baseAdjacencyCount([...withoutCurrent,{weekday,service:service as MainService,component:"main",recipe_id:r.id,protein_id:r.primary_protein_id,salad_recipe_id:null,beverage:null,locked:false,reasons:[]}],catalog,arrival)>1)
            dayReason=`Usar ${r.base_ingredient} consumiría más de la única excepción semanal de base consecutiva.`;
        }
        const stockReason=service==="salad"?null:menuStockReason(withoutCurrent,{recipe_id:r.id},catalog,diners);
        return{recipe:r,blocked:hard??quotaReason??dayReason??stockReason??(inWeek?"Esta preparación exacta ya está utilizada en la semana.":null)};
      })
      .sort((a,b)=>Number(!!a.blocked)-Number(!!b.blocked)||a.recipe.name.localeCompare(b.recipe.name,"es"));
  },[catalog,service,query,weekday,ctx,usedRecipeIds,proteinUseCounts,currentId,items,diners,arrival]);

  const valid=rows.filter(r=>!r.blocked),invalid=rows.filter(r=>r.blocked);
  return <div>
    <div className="flex flex-wrap items-center gap-2"><input className="input flex-1" placeholder="Buscar preparación…" value={query} onChange={e=>setQuery(e.target.value)}/>{allowEmpty?<button type="button" className="btn-ghost" onClick={()=>onPick(null)}>Sin ensalada</button>:null}</div>
    <p className="mt-3 text-[12px] text-muted">{valid.length} preparación(es) sin alertas para este espacio. Las opciones con alerta pueden seleccionarse manualmente bajo criterio del administrador.</p>
    <ul className="mt-2 space-y-1.5">{valid.map(({recipe})=><li key={recipe.id}><button type="button" onClick={()=>onPick(recipe.id)} className={`w-full rounded-lg border px-3 py-2 text-left transition hover:border-corp-500 hover:bg-corp-100 ${recipe.id===currentId?"border-corp-600 bg-corp-100":"border-line bg-white"}`}><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold text-navy-800">{recipe.name}</span><span className="text-[11px] text-muted">{lastUsed[recipe.id]?`Última vez: ${lastUsed[recipe.id]}`:"Sin uso reciente"}</span></div><div className="mt-1 flex flex-wrap gap-1"><Tag>{proteinLabel(catalog,recipe)}</Tag><Tag tone="muted">Base: {recipe.base_ingredient??"sin definir"}</Tag><Tag tone="muted">D{recipe.difficulty??1}</Tag></div></button></li>)}</ul>
    {invalid.length?<div className="mt-4"><button type="button" className="text-[12px] font-semibold text-corp-600 underline" onClick={()=>setShowInvalid(v=>!v)}>{showInvalid?"Ocultar":"Ver"} {invalid.length} preparación(es) con alerta</button>{showInvalid?<ul className="mt-2 space-y-1">{invalid.map(({recipe,blocked})=><li key={recipe.id}><button type="button" onClick={()=>onPick(recipe.id)} className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-[12px] text-amber-900"><div className="font-semibold text-navy-800">{recipe.name}</div><div className="mt-1"><strong>Alerta:</strong> {blocked}</div><div className="mt-1 font-semibold">Seleccionar de todos modos</div></button></li>)}</ul>:null}</div>:null}
  </div>;
}

function removeCurrent(items:MenuItem[],currentId:string|null){if(!currentId)return items;let removed=false;return items.filter(i=>{if(!removed&&i.recipe_id===currentId){removed=true;return false;}return true;});}
function porkExceptions(items:MenuItem[],catalog:Catalog){return [0,1,2,3,4,5,6].reduce((total,day)=>{const n=items.filter(i=>i.component==="main"&&i.weekday===day&&i.protein_id&&i.protein_id!=="chorizo"&&catalog.proteins.find(p=>p.id===i.protein_id)?.origin==="cerdo").length;return total+Math.max(0,n-1);},0);}
function baseAdjacencyCount(items:MenuItem[],catalog:Catalog,arrival:Weekday){const order=cycleOrder(arrival);let n=0;for(let x=0;x<order.length-1;x++){const left=new Set(items.filter(i=>i.component==="main"&&i.weekday===order[x]&&i.recipe_id).map(i=>catalog.recipes.find(r=>r.id===i.recipe_id)?.base_ingredient).filter((b):b is string=>isMeaningfulBase(b)));const right=new Set(items.filter(i=>i.component==="main"&&i.weekday===order[x+1]&&i.recipe_id).map(i=>catalog.recipes.find(r=>r.id===i.recipe_id)?.base_ingredient).filter((b):b is string=>isMeaningfulBase(b)));for(const b of left)if(right.has(b))n++;}return n;}
function proteinLabel(catalog:Catalog,recipe:Recipe){if(!recipe.primary_protein_id)return"Sin proteína animal";return catalog.proteins.find(p=>p.id===recipe.primary_protein_id)?.name??recipe.primary_protein_id;}
function Tag({children,tone}:{children:React.ReactNode;tone?:"muted"}){return <span className={`badge ${tone==="muted"?"bg-slate-100 text-slate-600":"bg-corp-100 text-corp-700"}`}>{children}</span>;}
