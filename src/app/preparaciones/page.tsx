import Header from "@/components/Header";
import RecipesClient from "./RecipesClient";
import { getRepo } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PreparacionesPage() {
  const catalog = await getRepo().getCatalog();
  return (
    <>
      <Header
        title="Preparaciones"
        subtitle="Catálogo de platos: proteína principal, servicios permitidos y productos que restringen su uso."
      />
      <div className="p-7">
        <RecipesClient catalog={catalog} />
      </div>
    </>
  );
}
