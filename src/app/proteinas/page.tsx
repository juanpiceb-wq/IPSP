import Header from "@/components/Header";
import ProteinsClient from "./ProteinsClient";
import { getRepo } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProteinasPage() {
  const catalog = await getRepo().getCatalog();
  return (
    <>
      <Header
        title="Proteínas"
        subtitle="Origen animal, servicios permitidos, máximo semanal y rendimiento. Todo editable sin tocar código."
      />
      <div className="p-7">
        <ProteinsClient proteins={catalog.proteins} />
      </div>
    </>
  );
}
