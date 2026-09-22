import Link from "next/link";
import Header from "@/components/Header";
import ComplianceDashboard from "@/components/ComplianceDashboard";
import { getRepo } from "@/lib/db";
import { isoWeekOf } from "@/lib/dates";
import { parityOfWeek } from "@/lib/rules";

export const dynamic="force-dynamic";
export default async function Home(){
  const repo=getRepo();const [catalog,menus]=await Promise.all([repo.getCatalog(),repo.listMenus()]);const now=isoWeekOf(new Date());
  return <><Header title="Inicio" subtitle={`Semana ${now.week} · ${parityOfWeek(now.week).toUpperCase()}`} right={<Link href="/generar" className="btn-primary">Planificar semana</Link>}/><div className="page-pad space-y-5"><section className="hero-strip"><div><div className="section-title">SEMANA ACTUAL</div><div className="mt-1 text-2xl font-semibold text-navy-900">Semana {now.week}</div><div className="mt-1 text-sm text-muted">Vista operacional de cumplimiento y consistencia del servicio.</div></div><div className="chip-dark">SEMANA {parityOfWeek(now.week).toUpperCase()}</div></section><ComplianceDashboard catalog={catalog} menus={menus}/></div></>;
}
