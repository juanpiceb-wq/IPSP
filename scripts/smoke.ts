import { MemoryRepo } from "../src/lib/db/memory";
import { blockingReason, buildContext, buildHistoryIndex } from "../src/lib/engine/context";
import { validateMenu } from "../src/lib/engine/validate";
import { finalizeMenu, type EligibleSlot } from "../src/lib/menuFinalizer";
import { buildExactProteinPlan } from "../src/lib/proteinPlanner";
import { parityOfWeek } from "../src/lib/rules";
import type { MainService, Weekday } from "../src/lib/types";

async function main(){
  const repo=new MemoryRepo();
  const catalog=await repo.getCatalog();
  const history=await repo.listMenus();
  const arrivals=[...new Set(catalog.camps.filter(c=>c.active).map(c=>c.reception_weekday_default))];
  let checked=0;

  for(const week of [40,41]){
    const parity=parityOfWeek(week);
    for(const arrival of arrivals){
      const camp=catalog.camps.find(c=>c.active&&c.reception_weekday_default===arrival)??catalog.camps.find(c=>c.active);
      if(!camp)throw new Error("Smoke: no active camp available.");
      const hist=buildHistoryIndex(history,2026,week,camp.id,catalog);
      const ctx=buildContext(catalog,parity,arrival,hist);
      const eligible:EligibleSlot[]=[];
      for(let d=0;d<7;d++){
        for(const service of ["breakfast","lunch","dinner"] as MainService[]){
          eligible.push({weekday:d,service,component:"main",ids:catalog.recipes.filter(r=>r.active&&!!r.primary_protein_id&&!r.services.includes("salad")&&!blockingReason(r,service,d as Weekday,ctx)).map(r=>r.id)});
        }
        if(d<6)eligible.push({weekday:d,service:"lunch",component:"soup",ids:catalog.recipes.filter(r=>r.active&&!blockingReason(r,"soup",d as Weekday,ctx)).map(r=>r.id)});
      }
      const plan=buildExactProteinPlan({catalog,parity,arrival,eligibleBySlot:eligible});
      const planMap=new Map(plan.map(x=>[`${x.weekday}|${x.service}`,x.proteinId]));
      const recipeById=new Map(catalog.recipes.map(r=>[r.id,r]));
      for(const slot of eligible){
        if(slot.component!=="main")continue;
        const pid=planMap.get(`${slot.weekday}|${slot.service}`);
        slot.ids=slot.ids.filter(id=>recipeById.get(id)?.primary_protein_id===pid);
      }
      const items=finalizeMenu({catalog,parity,arrival,eligibleBySlot:eligible,proteinPlan:plan,preferences:[]});
      const result=validateMenu({items,catalog,parity,arrival,year:2026,week,campId:camp.id,diners:camp.diners_default,history});
      const errors=result.issues.filter(i=>i.level==="error");
      if(errors.length)throw new Error(`Smoke week=${week} arrival=${arrival}: ${errors.map(e=>`${e.rule}: ${e.message}`).join(" | ")}`);
      if(result.metrics.mainCount!==21||result.metrics.soupCount!==6)throw new Error(`Smoke week=${week} arrival=${arrival}: structure ${result.metrics.mainCount}/21 mains, ${result.metrics.soupCount}/6 soups.`);
      checked++;
      console.log(`[smoke] OK week=${week} parity=${parity} arrival=${arrival} mains=21 soups=6 warnings=${result.metrics.warnings}`);
    }
  }
  console.log(`[smoke] deterministic production architecture passed ${checked} scenarios`);
}

main().catch(err=>{console.error(err instanceof Error?err.message:String(err));process.exit(1);});
