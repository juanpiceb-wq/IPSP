import Link from "next/link";
import Header from "@/components/Header";
import MenusClient from "./MenusClient";
import { getRepo } from "@/lib/db";
import { isGeneralAdmin } from "@/lib/access";
import type { MenuStatus } from "@/lib/types";

export const dynamic="force-dynamic";
export default async function MenusPage({searchParams}:{searchParams:{camp?:string;status?:string;year?:string;zone?:string;week?:string}}){
  const repo=getRepo();const [catalog,all]=await Promise.all([repo.getCatalog(),repo.listMenus()]);
  const zoneCamps=searchParams.zone?new Set(catalog.camps.filter(c=>c.zone_id===searchParams.zone).map(c=>c.id)):null;
  const menus=all.filter(m=>(!searchParams.camp||m.camp_id===searchParams.camp)&&(!zoneCamps||zoneCamps.has(m.camp_id))&&(!searchParams.week||m.week_number===Number(searchParams.week))&&(!searchParams.status||m.status===searchParams.status as MenuStatus)&&(!searchParams.year||m.year===Number(searchParams.year)));
  const years=Array.from(new Set(all.map(m=>m.year))).sort((a,b)=>b-a);
  return <><Header title="Menús" subtitle="Historial por campamento. Los menús en ejecución quedan bloqueados para edición." right={<Link href="/generar" className="btn-primary">Generar menú</Link>}/><div className="page-pad space-y-4"><form className="surface flex flex-wrap items-end gap-3 p-4" method="get"><div><label className="label">Campamento</label><select name="camp" className="input" defaultValue={searchParams.camp??""}><option value="">Todos</option>{catalog.camps.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div><label className="label">Zona</label><select name="zone" className="input" defaultValue={searchParams.zone??""}><option value="">Todas</option>{catalog.zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select></div><div><label className="label">Semana</label><select name="week" className="input" defaultValue={searchParams.week??""}><option value="">Todas</option>{Array.from(new Set(all.map(m=>m.week_number))).sort((a,b)=>b-a).map(w=><option key={w} value={w}>{w}</option>)}</select></div><div><label className="label">Estado</label><select name="status" className="input" defaultValue={searchParams.status??""}><option value="">Todos</option><option value="borrador">Borrador</option><option value="aprobado">Aprobado</option><option value="utilizado">Utilizado</option></select></div><div><label className="label">Año</label><select name="year" className="input" defaultValue={searchParams.year??""}><option value="">Todos</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></div><button className="btn-ghost" type="submit">Filtrar</button></form><MenusClient menus={menus} allMenus={all} catalog={catalog} generalAdmin={isGeneralAdmin()}/></div></>;
}
