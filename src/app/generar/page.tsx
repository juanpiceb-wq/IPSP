import Header from "@/components/Header";
import GeneratorClient from "./GeneratorClient";
import { getRepo } from "@/lib/db";
import { isoWeekOf } from "@/lib/dates";

export const dynamic="force-dynamic";
export default async function GenerarPage({searchParams}:{searchParams:{year?:string;week?:string;camp?:string}}){
  const repo=getRepo(); const [catalog,history]=await Promise.all([repo.getCatalog(),repo.listMenus()]);
  const now=isoWeekOf(new Date()); const year=Number(searchParams.year)||now.year; const week=Number(searchParams.week)||Math.min(now.week+1,53); const campId=searchParams.camp||catalog.camps.find(c=>c.active)?.id||"";
  const lastUsed:Record<string,string>={}; for(const menu of [...history].sort((a,b)=>a.year-b.year||a.week_number-b.week_number)){for(const item of menu.items){if(item.recipe_id)lastUsed[item.recipe_id]=`Semana ${menu.week_number}`;if(item.salad_recipe_id)lastUsed[item.salad_recipe_id]=`Semana ${menu.week_number}`;}}
  return <><Header title="Planificación semanal" subtitle="Generación inteligente con reglas, stock e historial aplicados automáticamente."/><div className="page-pad"><GeneratorClient catalog={catalog} lastUsed={lastUsed} defaults={{year,week,campId}}/></div></>;
}
