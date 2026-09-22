import Header from "@/components/Header";
import IngredientsClient from "./IngredientsClient";
import { getRepo } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function IngredientesPage() {
  const catalog = await getRepo().getCatalog();
  return (
    <>
      <Header
        title="Lista maestra de ingredientes"
        subtitle="Productos disponibles para el servicio. Los marcados como restrictivos condicionan en qué semana puede utilizarse una preparación."
      />
      <div className="p-7">
        <IngredientsClient ingredients={catalog.ingredients} recipes={catalog.recipes} />
      </div>
    </>
  );
}
