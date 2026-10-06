import type { Catalog, MainService, MenuItem, Parity, Recipe, Weekday } from "./types";
import { beverageLabel, cycleDistance, cycleOrder, RULES } from "./rules";
import { isMeaningfulBase } from "./engine/context";
import { sauceKey, soupNeedScore } from "./recipeRules";
import { mainAllowsSalad, saladAllowedForMain } from "./salads";
import type { ProteinSlot } from "./proteinPlanner";

export type EligibleSlot={weekday:number;service:string;component:string;ids:string[]};
export type RecipePreference={weekday:number;service:MainService;component:"main"|"soup";recipe_id:string;salad_recipe_id?:string|null};

/**
 * Convierte preferencias de IA en un menú canónico. La IA solo ordena candidatos:
 * la existencia de slots, proteína, receta y reglas duras quedan bajo control del motor.
 */
export function finalizeMenu(args:{
  catalog:Catalog; parity:Parity; arrival:Weekday; eligibleBySlot:EligibleSlot[];
  proteinPlan:ProteinSlot[]; preferences?:RecipePreference[]; locked?:MenuItem[];
  recencyPenalty?:Record<string,number>;
}):MenuItem[]{
  const recipeById=new Map(args.catalog.recipes.map(r=>[r.id,r]));
  const allowedBySlot=new Map(args.eligibleBySlot.map(s=>[slotKey(s.weekday as Weekday,s.service as MainService,s.component as "main"|"soup"),[...s.ids]]));
  const preferred=new Map<string,string>();
  for(const p of args.preferences??[]){
    const key=slotKey(p.weekday as Weekday,p.service,p.component);
    if(!preferred.has(key))preferred.set(key,p.recipe_id);
  }
  const locked=new Map((args.locked??[]).filter(x=>x.locked&&x.recipe_id).map(x=>[slotKey(x.weekday,x.service,x.component),x]));
  const recencyPenalty=args.recencyPenalty??{};

  const mains=solveMains(args.catalog,args.arrival,args.parity,args.proteinPlan,allowedBySlot,preferred,locked,recipeById,recencyPenalty);
  const soups=solveSoups(args.catalog,args.arrival,args.parity,allowedBySlot,preferred,locked,recipeById,new Set(mains.map(x=>x.recipe_id!).filter(Boolean)),recencyPenalty);
  const items=[...mains,...soups];
  assignSalads(items,args.catalog,args.parity,preferred,locked,recipeById);
  items.sort((a,b)=>a.weekday-b.weekday||serviceOrder(a.service)-serviceOrder(b.service)||(a.component==="soup"?-1:1));
  assertCanonical(items,args.catalog,args.proteinPlan);
  return items;
}

function solveMains(
  catalog:Catalog,arrival:Weekday,parity:Parity,plan:ProteinSlot[],allowedBySlot:Map<string,string[]>,
  preferred:Map<string,string>,locked:Map<string,MenuItem>,recipeById:Map<string,Recipe>,recencyPenalty:Record<string,number>
){
  const slots=plan.map(p=>{
    const key=slotKey(p.weekday,p.service,"main");
    let recipes=(allowedBySlot.get(key)??[]).map(id=>recipeById.get(id)).filter((r):r is Recipe=>!!r&&r.active&&r.primary_protein_id===p.proteinId);
    const lock=locked.get(key);
    if(lock?.recipe_id)recipes=recipes.filter(r=>r.id===lock.recipe_id);
    if(!recipes.length)throw new Error(`No existe preparación válida para ${key} con proteína ${p.proteinId}.`);
    return {...p,key,recipes};
  }).sort((a,b)=>a.recipes.length-b.recipes.length);

  const selected=new Map<string,Recipe>();
  const used=new Set<string>();

  const canUse=(slot:typeof slots[number],r:Recipe)=>{
    if(used.has(r.id))return false;
    const dayRecipes=[...selected.entries()].filter(([key])=>Number(key.split("|")[0])===slot.weekday).map(([,x])=>x);
    const difficulty=dayRecipes.reduce((s,x)=>s+(x.difficulty??1),0)+(r.difficulty??1);
    if(difficulty>RULES.MAX_DAILY_DIFFICULTY)return false;
    const sKey=sauceKey(r);
    if(sKey){
      for(const [key,other] of selected){
        if(sauceKey(other)!==sKey)continue;
        const otherDay=Number(key.split("|")[0]) as Weekday;
        if(cycleDistance(otherDay,slot.weekday,arrival)<=1)return false;
      }
    }
    const trial=[...selected.entries(),[slot.key,r] as [string,Recipe]];
    if(baseAdjacencyCount(trial,arrival)>1)return false;
    return true;
  };
  const score=(slot:typeof slots[number],r:Recipe)=>{
    let n=0;
    if(preferred.get(slot.key)===r.id)n+=1000;
    n-=recencyPenalty[r.id]??0;
    if(isChaulafan(r)){
      const previousArrival=((arrival+6)%7) as Weekday;
      n+=(slot.weekday===arrival||slot.weekday===previousArrival)?700:-300;
    }
    n-=(r.difficulty??1)*20;
    return n;
  };
  const solve=(i:number):boolean=>{
    if(i===slots.length)return true;
    const slot=slots[i];
    const options=[...slot.recipes].sort((a,b)=>score(slot,b)-score(slot,a)||a.name.localeCompare(b.name,"es"));
    for(const r of options){
      if(!canUse(slot,r))continue;
      selected.set(slot.key,r);used.add(r.id);
      if(solve(i+1))return true;
      selected.delete(slot.key);used.delete(r.id);
    }
    return false;
  };
  if(!solve(0))throw new Error("Las proteínas sí caben, pero no existe una combinación de preparaciones que cumpla simultáneamente dificultad, bases, salsas y plato único.");

  return plan.map(p=>{
    const key=slotKey(p.weekday,p.service,"main");const r=selected.get(key)!;const lock=locked.get(key);
    return makeItem(p.weekday,p.service,"main",r,parity,lock?.salad_recipe_id??null,lock?.locked??false,"Preparación seleccionada sobre un plan de proteína previamente validado.");
  });
}

function solveSoups(
  catalog:Catalog,arrival:Weekday,parity:Parity,allowedBySlot:Map<string,string[]>,preferred:Map<string,string>,
  locked:Map<string,MenuItem>,recipeById:Map<string,Recipe>,usedMain:Set<string>,recencyPenalty:Record<string,number>
){
  const soupTargets=new Map(catalog.proteins.filter(p=>p.active&&p.soup_only&&p.target_frequency>0&&(p.parity==="todas"||p.parity===parity)).map(p=>[p.id,p.target_frequency]));
  const keys=[0,1,2,3,4,5].map(d=>slotKey(d as Weekday,"lunch","soup"));
  const slots=keys.map(key=>{
    let recipes=(allowedBySlot.get(key)??[]).map(id=>recipeById.get(id)).filter((r):r is Recipe=>!!r&&r.active&&r.services.includes("soup")&&!usedMain.has(r.id));
    const lock=locked.get(key);if(lock?.recipe_id)recipes=recipes.filter(r=>r.id===lock.recipe_id);
    if(!recipes.length)throw new Error(`No existe sopa válida para ${key}.`);
    return{key,weekday:Number(key.split("|")[0]) as Weekday,recipes};
  }).sort((a,b)=>a.recipes.length-b.recipes.length);
  const selected=new Map<string,Recipe>();const used=new Set<string>(usedMain);const counts=new Map<string,number>();
  const canUse=(slot:typeof slots[number],r:Recipe)=>{
    if(used.has(r.id))return false;
    const pid=r.primary_protein_id;
    if(pid&&soupTargets.has(pid)&&(counts.get(pid)??0)>=(soupTargets.get(pid)??0))return false;
    if(pid){
      for(const [key,other] of selected){
        if(other.primary_protein_id!==pid)continue;
        const otherDay=Number(key.split("|")[0]) as Weekday;
        if(cycleDistance(otherDay,slot.weekday,arrival)<=RULES.MIN_PROTEIN_GAP_DAYS)return false;
      }
    }
    return true;
  };
  const feasible=()=>{
    for(const [pid,target] of soupTargets){
      const need=target-(counts.get(pid)??0);if(need<=0)continue;
      let capacity=0;
      for(const s of slots){if(selected.has(s.key))continue;if(s.recipes.some(r=>r.primary_protein_id===pid&&!used.has(r.id)))capacity++;}
      if(capacity<need)return false;
    }
    return true;
  };
  const score=(slot:typeof slots[number],r:Recipe)=>{
    let n=0;if(preferred.get(slot.key)===r.id)n+=1000;
    n-=recencyPenalty[r.id]??0;
    n+=soupNeedScore([...selected.entries()].map(([key,rr])=>makeItem(Number(key.split("|")[0]) as Weekday,"lunch","soup",rr,parity,null,false,"")),r,catalog);
    if(!r.primary_protein_id)n+=20;
    return n;
  };
  const solve=(i:number):boolean=>{
    if(i===slots.length)return [...soupTargets].every(([pid,target])=>(counts.get(pid)??0)===target);
    const slot=slots[i];const options=[...slot.recipes].sort((a,b)=>score(slot,b)-score(slot,a)||a.name.localeCompare(b.name,"es"));
    for(const r of options){if(!canUse(slot,r))continue;selected.set(slot.key,r);used.add(r.id);const pid=r.primary_protein_id;if(pid&&soupTargets.has(pid))counts.set(pid,(counts.get(pid)??0)+1);
      if(feasible()&&solve(i+1))return true;
      if(pid&&soupTargets.has(pid))counts.set(pid,(counts.get(pid)??1)-1);used.delete(r.id);selected.delete(slot.key);
    }return false;
  };
  if(!solve(0))throw new Error("No existe una combinación de seis sopas que cumpla las frecuencias estructuradas y la separación requerida.");
  return keys.map(key=>{const r=selected.get(key)!;const lock=locked.get(key);return makeItem(Number(key.split("|")[0]) as Weekday,"lunch","soup",r,parity,null,lock?.locked??false,"Sopa seleccionada por el cierre determinístico.");});
}

function assignSalads(items:MenuItem[],catalog:Catalog,parity:Parity,preferred:Map<string,string>,locked:Map<string,MenuItem>,recipeById:Map<string,Recipe>){
  const salads=catalog.recipes.filter(r=>r.active&&r.services.includes("salad"));
  const used=new Set<string>();let count=0;
  const targets=items.filter(i=>i.component==="main"&&(i.service==="lunch"||i.service==="dinner"));
  for(const item of targets){
    const lock=locked.get(slotKey(item.weekday,item.service,"main"));
    if(lock?.salad_recipe_id){const s=recipeById.get(lock.salad_recipe_id);const main=recipeById.get(item.recipe_id!);if(s&&main&&mainAllowsSalad(main)&&saladAllowedForMain(main,s)){item.salad_recipe_id=s.id;item.salad_recipe_name=s.name;used.add(s.id);count++;}}
  }
  const spread=[...targets].sort((a,b)=>a.weekday-b.weekday||serviceOrder(a.service)-serviceOrder(b.service));
  for(const item of spread){
    if(count>=RULES.SALAD_MIN)break;if(item.salad_recipe_id)continue;
    const main=recipeById.get(item.recipe_id!);if(!main||!mainAllowsSalad(main))continue;
    const options=salads.filter(s=>saladAllowedForMain(main,s)).sort((a,b)=>Number(used.has(a.id))-Number(used.has(b.id))||a.name.localeCompare(b.name,"es"));
    const pick=options[0];if(!pick)continue;item.salad_recipe_id=pick.id;item.salad_recipe_name=pick.name;used.add(pick.id);count++;
  }
  if(count<RULES.SALAD_MIN)throw new Error(`Solo fue posible asignar ${count} ensaladas compatibles; se requieren al menos ${RULES.SALAD_MIN}.`);
}

function assertCanonical(items:MenuItem[],catalog:Catalog,plan:ProteinSlot[]){
  const recipeById=new Map(catalog.recipes.map(r=>[r.id,r]));const seenSlots=new Set<string>();const usedRecipes=new Set<string>();
  if(items.filter(i=>i.component==="main").length!==21)throw new Error("Cierre inválido: no hay exactamente 21 platos fuertes.");
  if(items.filter(i=>i.component==="soup").length!==6)throw new Error("Cierre inválido: no hay exactamente 6 sopas.");
  const planMap=new Map(plan.map(p=>[slotKey(p.weekday,p.service,"main"),p.proteinId]));
  for(const item of items){
    const key=slotKey(item.weekday,item.service,item.component);if(seenSlots.has(key))throw new Error(`Cierre inválido: slot duplicado ${key}.`);seenSlots.add(key);
    if(!item.recipe_id||!recipeById.has(item.recipe_id))throw new Error(`Cierre inválido: ${key} quedó sin receta existente.`);
    if(usedRecipes.has(item.recipe_id))throw new Error(`Cierre inválido: ${recipeById.get(item.recipe_id)?.name??item.recipe_id} está repetida.`);usedRecipes.add(item.recipe_id);
    const r=recipeById.get(item.recipe_id)!;if(item.protein_id!==r.primary_protein_id)throw new Error(`Cierre inválido: proteína inconsistente en ${key}.`);
    if(item.component==="main"&&planMap.get(key)!==item.protein_id)throw new Error(`Cierre inválido: se alteró la proteína planificada en ${key}.`);
  }
}

function baseAdjacencyCount(entries:[string,Recipe][],arrival:Weekday){
  const cycle=cycleOrder(arrival);let count=0;
  for(let i=0;i<cycle.length;i++)for(let j=i+1;j<cycle.length;j++){
    const leftDay=cycle[i],rightDay=cycle[j];
    if(cycleDistance(leftDay,rightDay,arrival)!==1)continue;
    const left=new Set(entries.filter(([k])=>Number(k.split("|")[0])===leftDay).map(([,r])=>r.base_ingredient).filter((b):b is string=>isMeaningfulBase(b)));
    const right=new Set(entries.filter(([k])=>Number(k.split("|")[0])===rightDay).map(([,r])=>r.base_ingredient).filter((b):b is string=>isMeaningfulBase(b)));
    for(const b of left)if(right.has(b))count++;
  }return count;
}
function isChaulafan(r:Recipe){return `${r.id} ${r.name}`.toLocaleLowerCase("es").includes("chaulaf");}
function makeItem(weekday:Weekday,service:MainService,component:"main"|"soup",r:Recipe,parity:Parity,saladId:string|null,locked:boolean,reason:string):MenuItem{
  return{weekday,service,component,recipe_id:r.id,recipe_name:r.name,protein_id:r.primary_protein_id,salad_recipe_id:saladId,salad_recipe_name:null,beverage:component==="main"?beverageLabel(service,parity):null,locked,reasons:[reason],execution_status:"pending",replacement_name:null};
}
function slotKey(day:Weekday,service:MainService,component:"main"|"soup"){return`${day}|${service}|${component}`;}
function serviceOrder(s:MainService){return s==="breakfast"?0:s==="lunch"?1:2;}
