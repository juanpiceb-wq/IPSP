import Header from "@/components/Header";
import CampsClient from "./CampsClient";
import { getRepo } from "@/lib/db";
import { isGeneralAdmin } from "@/lib/access";

export const dynamic = "force-dynamic";
export default async function CampamentosPage() {
  const catalog = await getRepo().getCatalog();
  return <><Header title="Campamentos y zonas" subtitle="Estructura operativa, comensales y recepción principal de víveres."/><div className="page-pad"><CampsClient camps={catalog.camps} zones={catalog.zones} generalAdmin={isGeneralAdmin()}/></div></>;
}
