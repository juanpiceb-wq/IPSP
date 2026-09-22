import { notFound } from "next/navigation";
import Header from "@/components/Header";
import MenuDetailClient from "./MenuDetailClient";
import { getRepo } from "@/lib/db";
import { validateMenu } from "@/lib/engine/validate";
import { canManageExecution,isGeneralAdmin } from "@/lib/access";

export const dynamic="force-dynamic";
export default async function MenuDetail({params}:{params:{id:string}}){
  const repo=getRepo();const [catalog,menu,history]=await Promise.all([repo.getCatalog(),repo.getMenu(params.id),repo.listMenus()]);if(!menu)notFound();
  const validation=validateMenu({items:menu.items,catalog,parity:menu.parity,arrival:menu.supply_arrival_weekday,year:menu.year,week:menu.week_number,campId:menu.camp_id,diners:menu.diners,history:history.filter(m=>m.id!==menu.id)});
  const lastUsed:Record<string,string>={};for(const m of history.filter(m=>m.id!==menu.id).sort((a,b)=>a.year-b.year||a.week_number-b.week_number)){for(const item of m.items){if(item.recipe_id)lastUsed[item.recipe_id]=`Semana ${m.week_number}`;if(item.salad_recipe_id)lastUsed[item.salad_recipe_id]=`Semana ${m.week_number}`;}}
  const campName=catalog.camps.find(c=>c.id===menu.camp_id)?.name??menu.camp_id;
  return <><Header title={`Semana ${menu.week_number} · ${campName}`} subtitle={`${menu.year} · ${menu.parity.toUpperCase()} · ${menu.diners} comensales`}/><div className="page-pad"><MenuDetailClient menu={menu} catalog={catalog} lastUsed={lastUsed} initialIssues={validation.issues} initialMetrics={validation.metrics} generalAdmin={isGeneralAdmin()} canRecord={canManageExecution()}/></div></>;
}
