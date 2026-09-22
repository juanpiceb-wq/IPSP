"use client";

import { useMemo, useState } from "react";
import type { Catalog, ExecutionStatus, MenuItem, WeeklyMenu } from "@/lib/types";

export default function ComplianceDashboard({ catalog, menus }: { catalog: Catalog; menus: WeeklyMenu[] }) {
  const [scope,setScope]=useState("all");
  const filtered=useMemo(()=>{
    if(scope==="all") return menus;
    if(scope.startsWith("camp:")) return menus.filter(m=>m.camp_id===scope.slice(5));
    if(scope.startsWith("zone:")) { const ids=new Set(catalog.camps.filter(c=>c.zone_id===scope.slice(5)).map(c=>c.id)); return menus.filter(m=>ids.has(m.camp_id)); }
    return menus;
  },[scope,menus,catalog.camps]);
  const stats=useMemo(()=>executionStats(filtered,catalog),[filtered,catalog]);
  const trend=useMemo(()=>weeklyTrend(filtered),[filtered]);

  return <section className="surface p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-semibold text-navy-900">Cumplimiento del servicio</h2><p className="mt-1 text-sm text-muted">Seguimiento de lo planificado vs. lo ejecutado en cada cocina.</p></div>
      <select className="input w-auto min-w-[260px]" value={scope} onChange={e=>setScope(e.target.value)}><option value="all">Vista general · todos los campamentos</option>{catalog.zones.filter(z=>z.active).map(z=><option key={z.id} value={`zone:${z.id}`}>Zona · {z.name}</option>)}{catalog.camps.filter(c=>c.active).map(c=><option key={c.id} value={`camp:${c.id}`}>Campamento · {c.name}</option>)}</select>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi value={`${stats.adherence}%`} label="Cumplimiento" hint="componentes evaluados"/>
      <Kpi value={`${stats.evaluated}/${stats.totalApplicable}`} label="Controles realizados" hint="platos, sopas, ensaladas y bebidas"/>
      <Kpi value={String(stats.notComplies)} label="No cumplimientos" hint="componentes marcados no cumple"/>
      <Kpi value={String(stats.reviewedMenus)} label="Semanas revisadas" hint="con al menos un control registrado"/>
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,.8fr)]">
      <div className="rounded-xl border border-line bg-white p-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-navy-900">Evolución del cumplimiento</h3><p className="text-xs text-muted">Últimas 10 semanas con registros.</p></div></div><TrendChart points={trend}/></div>
      <div className="rounded-xl border border-line bg-white p-4"><h3 className="font-semibold text-navy-900">Lectura rápida</h3><div className="mt-4 space-y-3 text-sm"><Quick label="Campamentos con revisión" value={`${stats.campsReviewed}/${catalog.camps.filter(c=>c.active).length}`}/><Quick label="Platos distintos evaluados" value={String(stats.recipeStats.length)}/><Quick label="Cumplimientos registrados" value={String(stats.complies)}/><Quick label="No cumplimientos registrados" value={String(stats.notComplies)}/></div></div>
    </div>

    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <RecipeList title="Platos con mayor cumplimiento" rows={stats.topRecipes} tone="good"/>
      <RecipeList title="Platos con menor cumplimiento" rows={stats.lowRecipes} tone="bad"/>
    </div>
  </section>;
}

function Kpi({value,label,hint}:{value:string;label:string;hint:string}){return <div className="kpi-card"><div className="text-2xl font-semibold text-corp-700">{value}</div><div className="mt-1 text-sm font-semibold text-navy-900">{label}</div><div className="text-xs text-muted">{hint}</div></div>}
function Quick({label,value}:{label:string;value:string}){return <div className="flex items-center justify-between gap-4 border-b border-line pb-2 last:border-0"><span className="text-muted">{label}</span><strong className="text-navy-900">{value}</strong></div>}

function RecipeList({title,rows,tone}:{title:string;rows:RecipeStat[];tone:"good"|"bad"}){return <div className="rounded-xl border border-line bg-white p-4"><h3 className="font-semibold text-navy-900">{title}</h3><div className="mt-3 space-y-2">{rows.slice(0,6).map((r,i)=><div key={r.id} className="flex items-center gap-3 rounded-lg bg-shell px-3 py-2"><div className={`rank-dot ${tone==="good"?"bg-emerald-100 text-emerald-700":"bg-red-100 text-red-700"}`}>{i+1}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-navy-900">{r.name}</div><div className="text-xs text-muted">{r.evaluated} evaluaciones</div></div><strong className={tone==="good"?"text-emerald-700":"text-red-700"}>{r.rate}%</strong></div>)}{!rows.length?<p className="text-sm text-muted">Aún no hay suficiente cumplimiento registrado.</p>:null}</div></div>}

type RecipeStat={id:string;name:string;evaluated:number;complies:number;rate:number};
function norm(s:ExecutionStatus|undefined){if(s==="complies"||s==="as_planned")return "complies";if(s==="not_complies"||s==="replaced")return "not_complies";return "pending";}
function itemComponents(i:MenuItem){const out:{status:ExecutionStatus|undefined;recipeId?:string|null}[]=[];if(i.component==="soup") {out.push({status:i.execution_status,recipeId:i.recipe_id});return out;}out.push({status:i.execution_status,recipeId:i.recipe_id});if(i.service!=="breakfast"&&i.salad_recipe_id)out.push({status:i.salad_execution_status,recipeId:i.salad_recipe_id});out.push({status:i.beverage_execution_status});return out;}
function executionStats(menus:WeeklyMenu[],catalog:Catalog){
  let totalApplicable=0,evaluated=0,complies=0,notComplies=0;const byRecipe=new Map<string,{evaluated:number;complies:number}>();const campSet=new Set<string>();let reviewedMenus=0;
  for(const m of menus){let menuEval=0;for(const i of m.items){for(const c of itemComponents(i)){totalApplicable++;const s=norm(c.status);if(s==="pending")continue;evaluated++;menuEval++;if(s==="complies")complies++;else notComplies++;}
      if(i.component==="main"&&i.recipe_id){const ms=norm(i.execution_status);if(ms!=="pending"){const x=byRecipe.get(i.recipe_id)??{evaluated:0,complies:0};x.evaluated++;if(ms==="complies")x.complies++;byRecipe.set(i.recipe_id,x);}}
    }if(menuEval){reviewedMenus++;campSet.add(m.camp_id);}}
  const recipeStats:Array<RecipeStat>=Array.from(byRecipe,([id,x])=>({id,name:catalog.recipes.find(r=>r.id===id)?.name??id,evaluated:x.evaluated,complies:x.complies,rate:x.evaluated?Math.round(x.complies/x.evaluated*100):0}));
  const topRecipes=[...recipeStats].sort((a,b)=>b.rate-a.rate||b.evaluated-a.evaluated);const lowRecipes=[...recipeStats].sort((a,b)=>a.rate-b.rate||b.evaluated-a.evaluated);
  return {totalApplicable,evaluated,complies,notComplies,adherence:evaluated?Math.round(complies/evaluated*100):0,reviewedMenus,campsReviewed:campSet.size,recipeStats,topRecipes,lowRecipes};
}
function weeklyTrend(menus:WeeklyMenu[]){const groups=new Map<string,{year:number;week:number,ok:number,n:number}>();for(const m of menus){const k=`${m.year}-${m.week_number}`;const g=groups.get(k)??{year:m.year,week:m.week_number,ok:0,n:0};for(const i of m.items){for(const c of itemComponents(i)){const s=norm(c.status);if(s==="pending")continue;g.n++;if(s==="complies")g.ok++;}}groups.set(k,g);}return [...groups.values()].filter(g=>g.n>0).sort((a,b)=>a.year-b.year||a.week-b.week).slice(-10).map(g=>({label:`S${g.week}`,value:Math.round(g.ok/g.n*100)}));}
function TrendChart({points}:{points:{label:string;value:number}[]}){if(!points.length)return <div className="flex h-52 items-center justify-center text-sm text-muted">Aún no hay semanas con cumplimiento registrado.</div>;const w=700,h=210,p=28;const step=points.length>1?(w-p*2)/(points.length-1):0;const xy=points.map((d,i)=>({x:p+i*step,y:h-p-(d.value/100)*(h-p*2),...d}));return <div className="mt-3 overflow-x-auto"><svg viewBox={`0 0 ${w} ${h}`} className="min-w-[620px] w-full"><line x1={p} y1={h-p} x2={w-p} y2={h-p} stroke="#dce3ea"/><line x1={p} y1={p} x2={p} y2={h-p} stroke="#dce3ea"/>{[0,50,100].map(v=>{const y=h-p-(v/100)*(h-p*2);return <g key={v}><line x1={p} y1={y} x2={w-p} y2={y} stroke="#edf1f4"/><text x={4} y={y+4} fontSize="10" fill="#667c8c">{v}%</text></g>})}<polyline fill="none" stroke="#0b5fa5" strokeWidth="3" points={xy.map(d=>`${d.x},${d.y}`).join(" ")}/>{xy.map(d=><g key={d.label}><circle cx={d.x} cy={d.y} r="4" fill="#0b5fa5"/><text x={d.x} y={h-8} textAnchor="middle" fontSize="10" fill="#667c8c">{d.label}</text><text x={d.x} y={d.y-10} textAnchor="middle" fontSize="10" fontWeight="600" fill="#0b2e4f">{d.value}%</text></g>)}</svg></div>}
