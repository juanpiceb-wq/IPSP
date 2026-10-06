"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { actionDeleteMenu } from "@/app/actions";
import { STATUS_LABEL } from "@/lib/types";
import { formatDate, hasDateStarted } from "@/lib/dates";
import type { Camp, WeeklyMenu } from "@/lib/types";

export default function MenusClient({menus,camps,generalAdmin}:{menus:WeeklyMenu[];camps:Camp[];generalAdmin:boolean}){
  const router=useRouter();
  const started=(m:WeeklyMenu)=>hasDateStarted(m.actual_start_date);
  return <div className="surface overflow-hidden"><table className="w-full"><thead><tr><th className="th">Semana</th><th className="th">Campamento</th><th className="th">Paridad</th><th className="th">Uso real</th><th className="th">Comensales</th><th className="th">Estado</th><th className="th"></th></tr></thead><tbody>{menus.map(m=><tr key={m.id} className="hover:bg-corp-100/30"><td className="td font-semibold text-navy-900">{m.year} · Semana {m.week_number}</td><td className="td">{camps.find(c=>c.id===m.camp_id)?.name??m.camp_id}</td><td className="td"><span className={m.parity==="par"?"chip-dark":"chip-info"}>{m.parity.toUpperCase()}</span></td><td className="td text-xs text-muted">{m.actual_start_date?`${formatDate(m.actual_start_date)} → ${formatDate(m.actual_end_date)}`:"—"}</td><td className="td">{m.diners}</td><td className="td"><span className="chip-muted">{STATUS_LABEL[m.status]}</span></td><td className="td"><div className="flex justify-end gap-2"><Link href={`/menus/${m.id}`} className="btn-ghost btn-sm">Abrir</Link>{generalAdmin&&!started(m)?<button className="btn-danger-ghost btn-sm" onClick={async()=>{if(!confirm(`¿Eliminar el menú de la semana ${m.week_number}?`))return;try{await actionDeleteMenu(m.id);router.refresh();}catch(e){alert(e instanceof Error?e.message:"No se pudo eliminar.")}}}>Eliminar</button>:null}</div></td></tr>)}{!menus.length?<tr><td colSpan={7} className="td text-muted">No hay menús con esos filtros.</td></tr>:null}</tbody></table></div>;
}
