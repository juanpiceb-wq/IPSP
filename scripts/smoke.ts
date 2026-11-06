import { MemoryRepo } from "../src/lib/db/memory";
import { SupabaseRepo } from "../src/lib/db/supabase";
import { validateMenu } from "../src/lib/engine/validate";
import { finalizeMenu } from "../src/lib/menuFinalizer";
import { buildSharedEligibleSlots, lastDayProteins, planFeasibleMenu, previousWeekMenu } from "../src/lib/sharedPlanning";
import { projectSharedItems } from "../src/lib/sharedWeek";
import { cyclePosition, parityOfWeek, projectWeekday } from "../src/lib/rules";
import type { Weekday } from "../src/lib/types";

/** La proyección entre recepciones deja el domingo fijo, conserva el orden del resto y es reversible. */
function checkProjection(){
  const days=[0,1,2,3,4,5,6] as Weekday[];
  for(const source of days)for(const target of days){
    const mapped=days.map(d=>projectWeekday(d,source,target));
    if(new Set(mapped).size!==7)throw new Error(`Smoke proyección ${source}->${target}: no es biyectiva.`);
    if(projectWeekday(6,source,target)!==6)throw new Error(`Smoke proyección ${source}->${target}: el domingo se movió.`);
    for(const d of days)if(projectWeekday(projectWeekday(d,source,target),target,source)!==d)throw new Error(`Smoke proyección ${source}->${target}: no es reversible.`);
    const order=(arrival:Weekday,ds:Weekday[])=>[...ds].sort((a,b)=>cyclePosition(a,arrival)-cyclePosition(b,arrival));
    const weekdays=days.filter(d=>d!==6);
    const before=order(source,weekdays).map(d=>projectWeekday(d,source,target)).join();
    const after=order(target,weekdays.map(d=>projectWeekday(d,source,target))).join();
    if(before!==after)throw new Error(`Smoke proyección ${source}->${target}: cambió el orden de los días.`);
  }
  // Martes ↔ miércoles: igual que antes (solo se cruzan el domingo y el día contiguo).
  const tueToWed=[0,1,2,3,4,5,6].map(d=>projectWeekday(d as Weekday,1,2)).join();
  if(tueToWed!==[1,2,3,4,5,0,6].join())throw new Error(`Smoke proyección martes->miércoles cambió: ${tueToWed}`);
  // Martes → jueves: vie=Día 1, sáb=Día 2, dom fijo, lun=Día 3, mar=Día 4, mié=Día 6, jue=Día 7.
  const tueToThu=[2,3,4,5,6,0,1].map(d=>projectWeekday(d as Weekday,1,3)).join();
  if(tueToThu!==[4,5,0,1,6,2,3].join())throw new Error(`Smoke proyección martes->jueves inesperada: ${tueToThu}`);
  console.log("[smoke] OK proyección entre recepciones");
}

async function main(){
  checkProjection();
  const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const repo=url&&key?new SupabaseRepo(url,key):new MemoryRepo();
  console.log(`[smoke] catalog source=${repo.mode}`);
  const catalog=await repo.getCatalog();
  const history=await repo.listMenus({limit:10});
  const arrivals=[...new Set(catalog.camps.filter(c=>c.active).map(c=>c.reception_weekday_default))];
  if(!arrivals.length)throw new Error("Smoke: no active reception day available.");
  let checked=0;

  for(const week of [40,41]){
    const parity=parityOfWeek(week);
    for(const arrival of arrivals){
      const camp=catalog.camps.find(c=>c.active&&c.reception_weekday_default===arrival)??catalog.camps.find(c=>c.active);
      if(!camp)throw new Error("Smoke: no active camp available.");
      const eligibleAll=buildSharedEligibleSlots({catalog,parity,arrival,arrivals,history,year:2026,week,campId:camp.id});
      const previous=lastDayProteins(previousWeekMenu(history,camp.id,2026,week));
      const feasible=planFeasibleMenu({catalog,parity,arrival,arrivals,eligibleBySlot:eligibleAll,previous,seedBase:`smoke-${week}-${arrival}`});
      const items=finalizeMenu({catalog,parity,arrival,eligibleBySlot:feasible.eligibleBySlot,proteinPlan:feasible.plan,preferences:[],arrivals,previousLastDaySoupProteins:previous.soups});
      // El menú maestro se valida proyectado a cada recepción activa que lo comparte.
      for(const target of arrivals){
        const targetCamp=catalog.camps.find(c=>c.active&&c.reception_weekday_default===target)??camp;
        const projected=validateMenu({items:projectSharedItems(items,arrival,target),catalog,parity,arrival:target,year:2026,week,campId:targetCamp.id,diners:targetCamp.diners_default,history});
        const projectedErrors=projected.issues.filter(i=>i.level==="error");
        if(projectedErrors.length)throw new Error(`Smoke week=${week} base=${arrival} target=${target}: ${projectedErrors.map(e=>`${e.rule}: ${e.message}`).join(" | ")}`);
      }
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
