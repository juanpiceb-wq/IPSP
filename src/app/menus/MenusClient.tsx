"use client";

import Link from "next/link";
import { useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { actionDeleteMenu } from "@/app/actions";
import { exportMenuPdf } from "@/lib/exportMenuPdf";
import { exportComedorExcel } from "@/lib/exportComedorExcel";
import { buildZoneBlocks, previousSource } from "@/lib/zoneBlocks";
import { STATUS_LABEL } from "@/lib/types";
import { formatDate } from "@/lib/dates";
import type { Catalog, WeeklyMenu } from "@/lib/types";

export default function MenusClient({menus,allMenus,catalog,generalAdmin}:{menus:WeeklyMenu[];allMenus:WeeklyMenu[];catalog:Catalog;generalAdmin:boolean}){
  const router=useRouter();
  const [selected,setSelected]=useState<string[]>([]);
  const [exporting,setExporting]=useState(false);
  const campZone=useMemo(()=>new Map(catalog.camps.map(c=>[c.id,c.zone_id??null])),[catalog]);
  const zoneName=(campId:string)=>{const z=campZone.get(campId);return z?catalog.zones.find(x=>x.id===z)?.name??"—":"Sin zona";};
  const weeksAvailable=useMemo(()=>Array.from(new Set(menus.map(m=>`${m.year}|${m.week_number}`))).sort((a,b)=>{const [ya,wa]=a.split("|").map(Number);const [yb,wb]=b.split("|").map(Number);return yb-ya||wb-wa;}),[menus]);
  const [zoneWeek,setZoneWeek]=useState<string>(weeksAvailable[0]??"");
  const [zonePick,setZonePick]=useState<string[]>([]);
  const zonesWithMenus=catalog.zones.filter(z=>menus.some(m=>campZone.get(m.camp_id)===z.id));
  const menusForZones=(zoneIds:string[])=>{const [y,w]=zoneWeek.split("|").map(Number);return menus.filter(m=>m.year===y&&m.week_number===w&&zoneIds.includes(campZone.get(m.camp_id)??""));};
  const selectZones=(add:boolean)=>{const ids=menusForZones(zonePick).map(m=>m.id);setSelected(prev=>add?Array.from(new Set([...prev,...ids])):prev.filter(id=>!ids.includes(id)));};
  async function exportExcelZones(){
    if(!selectedMenus.length)return;
    setExporting(true);
    try{
      const {blocks,warnings}=buildZoneBlocks(selectedMenus,allMenus,catalog);
      if(!blocks.length){alert("Los menús seleccionados no tienen platos cargados.");return;}
      await exportComedorExcel(blocks,catalog);
      if(warnings.length)alert(`Excel generado con ${blocks.length} bloque(s). Revise:\n\n${warnings.join("\n")}`);
    }finally{setExporting(false)}
  }
  const started=(m:WeeklyMenu)=>!!m.actual_start_date && new Date().toISOString().slice(0,10)>=m.actual_start_date;
  const selectedMenus=useMemo(()=>menus.filter(m=>selected.includes(m.id)),[menus,selected]);
  const allVisibleSelected=menus.length>0&&menus.every(m=>selected.includes(m.id));
  const toggle=(id:string)=>setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  const toggleAll=()=>setSelected(prev=>allVisibleSelected?prev.filter(id=>!menus.some(m=>m.id===id)):Array.from(new Set([...prev,...menus.map(m=>m.id)])));
  async function exportSelected(includeOperationalPortions:boolean){
    if(!selectedMenus.length)return;
    setExporting(true);
    try{
      const missing:string[]=[];
      const ready=selectedMenus.filter(m=>{
        if(m.items.length)return true;
        const campName=catalog.camps.find(c=>c.id===m.camp_id)?.name??m.camp_id;
        missing.push(`${campName} · semana ${m.week_number}`);
        return false;
      });
      for(let i=0;i<ready.length;i++){
        const m=ready[i];
        exportMenuPdf({items:m.items,catalog,year:m.year,previous:previousSource(allMenus,m),week:m.week_number,parity:m.parity,campId:m.camp_id,diners:m.diners,start:m.actual_start_date,end:m.actual_end_date,arrival:m.supply_arrival_weekday,includeOperationalPortions});
        if(i<ready.length-1)await new Promise(resolve=>setTimeout(resolve,180));
      }
      if(missing.length)alert(`No se generaron PDFs vacíos. Estos menús no llegaron con items cargados:\n\n${missing.join("\n")}\n\nRecargue la página y vuelva a intentar.`);
    }finally{setExporting(false)}
  }
  return <div className="space-y-3">
    <div className="surface flex flex-wrap items-center gap-3 p-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-navy-900"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll}/><span>Seleccionar todos los visibles</span></label>
      <span className="text-xs text-muted">{selected.length} seleccionado{selected.length===1?"":"s"}</span>
      <div className="ml-auto flex flex-wrap gap-2"><button className="btn-ghost btn-sm" disabled={!selectedMenus.length||exporting} onClick={()=>exportSelected(false)}>{exporting?"Descargando…":"PDFs menú"}</button><button className="btn-ghost btn-sm" disabled={!selectedMenus.length||exporting} onClick={()=>exportSelected(true)}>{exporting?"Descargando…":"PDFs + porciones"}</button><button className="btn-primary btn-sm" disabled={!selectedMenus.length||exporting} onClick={exportExcelZones}>{exporting?"Descargando…":"Excel COMEDOR (por zona)"}</button></div>
    </div>
    <div className="surface flex flex-wrap items-center gap-3 p-3">
      <span className="text-sm font-medium text-navy-900">Seleccionar por zona</span>
      <select className="input w-auto" value={zoneWeek} onChange={e=>setZoneWeek(e.target.value)} aria-label="Semana para seleccionar por zona">{weeksAvailable.map(k=>{const [y,w]=k.split("|");return <option key={k} value={k}>{y} · Semana {w}</option>})}</select>
      <div className="flex flex-wrap gap-2">{zonesWithMenus.map(z=><label key={z.id} className={`chip-muted cursor-pointer ${zonePick.includes(z.id)?"bg-corp-100 text-navy-900":""}`}><input type="checkbox" className="mr-1" checked={zonePick.includes(z.id)} onChange={()=>setZonePick(prev=>prev.includes(z.id)?prev.filter(x=>x!==z.id):[...prev,z.id])}/>{z.name}</label>)}{!zonesWithMenus.length?<span className="text-xs text-muted">No hay zonas con menús visibles.</span>:null}</div>
      <div className="ml-auto flex gap-2"><button className="btn-ghost btn-sm" disabled={!zonePick.length||!zoneWeek} onClick={()=>selectZones(true)}>Seleccionar zonas</button><button className="btn-ghost btn-sm" disabled={!zonePick.length||!zoneWeek} onClick={()=>selectZones(false)}>Quitar zonas</button></div>
    </div>
    <div className="surface overflow-hidden"><table className="w-full"><thead><tr><th className="th w-10"></th><th className="th">Semana</th><th className="th">Campamento</th><th className="th">Zona</th><th className="th">Paridad</th><th className="th">Uso real</th><th className="th">Comensales</th><th className="th">Estado</th><th className="th"></th></tr></thead><tbody>{menus.map(m=><tr key={m.id} className={`hover:bg-corp-100/30 ${selected.includes(m.id)?"bg-corp-100/40":""}`}><td className="td"><input type="checkbox" checked={selected.includes(m.id)} onChange={()=>toggle(m.id)} aria-label={`Seleccionar ${catalog.camps.find(c=>c.id===m.camp_id)?.name??m.camp_id} semana ${m.week_number}`}/></td><td className="td font-semibold text-navy-900">{m.year} · Semana {m.week_number}</td><td className="td">{catalog.camps.find(c=>c.id===m.camp_id)?.name??m.camp_id}</td><td className="td text-xs">{zoneName(m.camp_id)}</td><td className="td"><span className={m.parity==="par"?"chip-dark":"chip-info"}>{m.parity.toUpperCase()}</span></td><td className="td text-xs text-muted">{m.actual_start_date?`${formatDate(m.actual_start_date)} → ${formatDate(m.actual_end_date)}`:"—"}</td><td className="td">{m.diners}</td><td className="td"><span className="chip-muted">{STATUS_LABEL[m.status]}</span></td><td className="td"><div className="flex justify-end gap-2"><Link href={`/menus/${m.id}`} className="btn-ghost btn-sm">Abrir</Link>{generalAdmin&&!started(m)?<button className="btn-danger-ghost btn-sm" onClick={async()=>{if(!confirm(`¿Eliminar el menú de la semana ${m.week_number}?`))return;try{await actionDeleteMenu(m.id);setSelected(prev=>prev.filter(id=>id!==m.id));router.refresh();}catch(e){alert(e instanceof Error?e.message:"No se pudo eliminar.")}}}>Eliminar</button>:null}</div></td></tr>)}{!menus.length?<tr><td colSpan={9} className="td text-muted">No hay menús con esos filtros.</td></tr>:null}</tbody></table></div>
  </div>
}
