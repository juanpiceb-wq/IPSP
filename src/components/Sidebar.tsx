"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV=[
  {href:"/",label:"Inicio",icon:"home"},
  {href:"/generar",label:"Planificación",icon:"calendar"},
  {href:"/menus",label:"Menús",icon:"history"},
  {href:"/preparaciones",label:"Preparaciones",icon:"dish"},
  {href:"/proteinas",label:"Proteínas",icon:"protein"},
  {href:"/productos",label:"Restricciones",icon:"shield"},
  {href:"/ingredientes",label:"Ingredientes",icon:"leaf"},
  {href:"/campamentos",label:"Campamentos",icon:"camp"},
  {href:"/reglas",label:"Reglas",icon:"settings"},
];
export default function Sidebar({mode}:{mode:"supabase"|"demo"}){const pathname=usePathname();return <aside className="no-print sticky top-0 flex h-screen w-[228px] shrink-0 flex-col border-r border-white/10 bg-navy-900 text-white"><div className="px-5 py-5"><div className="text-[10px] font-semibold uppercase tracking-[.19em] text-corp-300">Sistema de control</div><div className="mt-1 text-base font-semibold">Proyecto de Mejora de Alimentación IPSP</div></div><nav className="flex-1 space-y-1 px-3 py-2">{NAV.map(item=>{const active=item.href==="/"?pathname==="/":pathname.startsWith(item.href);return <Link key={item.href} href={item.href} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition ${active?"bg-corp-600 font-semibold text-white":"text-corp-100 hover:bg-white/10 hover:text-white"}`}><Icon name={item.icon}/><span>{item.label}</span></Link>})}</nav><div className="border-t border-white/10 px-4 py-4 text-[10.5px] text-corp-300"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${mode==="supabase"?"bg-emerald-400":"bg-amber-300"}`}/><span>{mode==="supabase"?"Persistencia activa":"Modo demostración"}</span></div></div></aside>}
function Icon({name}:{name:string}){const paths:Record<string,React.ReactNode>={home:<><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></>,calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>,history:<><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,dish:<><path d="M4 18h16M6 18a6 6 0 0 1 12 0M12 9V6"/></>,protein:<><path d="M7 4c2-2 4 0 5 1 1-1 3-3 5-1 3 3 1 7-1 9-2 2-6 4-9 1-3-3-3-7 0-10Z"/></>,shield:<><path d="M12 3 5 6v5c0 5 3.5 8 7 10 3.5-2 7-5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,leaf:<><path d="M20 4S11 3 7 7s-3 13-3 13 9 1 13-3 3-13 3-13Z"/><path d="M4 20c4-4 7-7 12-10"/></>,camp:<><path d="m3 20 9-16 9 16H3Z"/><path d="m9 20 3-6 3 6"/></>,settings:<><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="11" cy="18" r="2"/></>};return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-80 group-hover:opacity-100">{paths[name]}</svg>}

