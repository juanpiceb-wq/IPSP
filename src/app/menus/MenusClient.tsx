"use client";

import Link from "next/link";
import { useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { actionDeleteMenu } from "@/app/actions";
import { exportMenuPdf } from "@/lib/exportMenuPdf";
import { STATUS_LABEL } from "@/lib/types";
import { formatDate } from "@/lib/dates";
import type { Catalog, WeeklyMenu } from "@/lib/types";

export default function MenusClient({menus,catalog,generalAdmin}:{menus:WeeklyMenu[];catalog:Catalog;generalAdmin:boolean}){
  const router=useRouter();
  const [selected,setSelected]=useState<string[]>([]);
  const [exporting,setExporting]=useState(false);
  const started=(m:WeeklyMenu)=>!!m.actual_start_date && new Date().toISOString().slice(0,10)>=m.actual_start_date;
  const selectedMenus=useMemo(()=>menus.filter(m=>selected.includes(m.id)),[menus,selected]);
  const allVisibleSelected=menus.length>0&&menus.every(m=>selected.includes(m.id));
  const toggle=(id:string)=>setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  const toggleAll=()=>setSelected(prev=>allVisibleSelected?prev.filter(id=>!menus.some(m=>m.id===id)):Array.from(new Set([...prev,...menus.map(m=>m.id)])));
  async function exportSelected(includeOperationalPortions:boolean){
    if(!selectedMenus.length)return;
    setExporting(true);
    try{
      for(let i=0;i<selectedMenus.length;i++){
        const m=selectedMenus[i];
        exportMenuPdf({items:m.items,catalog,week:m.week_number,parity:m.parity,campId:m.camp_id,diners:m.diners,start:m.actual_start_date,end:m.actual_end_date,arrival:m.supply_arrival_weekday,includeOperationalPortions});
        if(i<selectedMenus.length-1)await new Promise(resolve=>setTimeout(resolve,180));
      }
    }finally{setExporting(false)}
  }
  return <div className="space-y-3">
    <div className="surface flex flex-wrap items-center gap-3 p-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-navy-900"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll}/><span>Seleccionar todos los visibles</span></label>
      <span className="text-xs text-muted">{selected.length} seleccionado{selected.length===1?"":"s"}</span>
      <div className="ml-auto flex flex-wrap gap-2"><button className="btn-ghost btn-sm" disabled={!selectedMenus.length||exporting} onClick={()=>exportSelected(false)}>{exporting?"Descargando…":"PDFs menú"}</button><button className="btn-ghost btn-sm" disabled={!selectedMenus.length||exporting} onClick={()=>exportSelected(true)}>{exporting?"Descargando…":"PDFs + porciones"}</button></div>
    </div>
    <div className="surface overflow-hidden"><table className="w-full"><thead><tr><th className="th w-10"></th><th className="th">Semana</th><th className="th">Campamento</th><th className="th">Paridad</th><th className="th">Uso real</th><th className="th">Comensales</th><th className="th">Estado</th><th className="th"></th></tr></thead><tbody>{menus.map(m=><tr key={m.id} className={`hover:bg-corp-100/30 ${selected.includes(m.id)?"bg-corp-100/40":""}`}><td className="td"><input type="checkbox" checked={selected.includes(m.id)} onChange={()=>toggle(m.id)} aria-label={`Seleccionar ${catalog.camps.find(c=>c.id===m.camp_id)?.name??m.camp_id} semana ${m.week_number}`}/></td><td className="td font-semibold text-navy-900">{m.year} · Semana {m.week_number}</td><td className="td">{catalog.camps.find(c=>c.id===m.camp_id)?.name??m.camp_id}</td><td className="td"><span className={m.parity==="par"?"chip-dark":"chip-info"}>{m.parity.toUpperCase()}</span></td><td className="td text-xs text-muted">{m.actual_start_date?`${formatDate(m.actual_start_date)} → ${formatDate(m.actual_end_date)}`:"—"}</td><td className="td">{m.diners}</td><td className="td"><span className="chip-muted">{STATUS_LABEL[m.status]}</span></td><td className="td"><div className="flex justify-end gap-2"><Link href={`/menus/${m.id}`} className="btn-ghost btn-sm">Abrir</Link>{generalAdmin&&!started(m)?<button className="btn-danger-ghost btn-sm" onClick={async()=>{if(!confirm(`¿Eliminar el menú de la semana ${m.week_number}?`))return;try{await actionDeleteMenu(m.id);setSelected(prev=>prev.filter(id=>id!==m.id));router.refresh();}catch(e){alert(e instanceof Error?e.message:"No se pudo eliminar.")}}}>Eliminar</button>:null}</div></td></tr>)}{!menus.length?<tr><td colSpan={8} className="td text-muted">No hay menús con esos filtros.</td></tr>:null}</tbody></table></div>
  </div>
}
