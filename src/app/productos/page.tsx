import Header from "@/components/Header";
import ProductsClient from "./ProductsClient";
import { getRepo } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const catalog = await getRepo().getCatalog();
  return (
    <>
      <Header
        title="Productos restrictivos"
        subtitle="Productos que condicionan cuándo puede utilizarse una preparación: semana par, semana impar o día de llegada."
      />
      <div className="p-7">
        <ProductsClient products={catalog.products} recipes={catalog.recipes} />
      </div>
    </>
  );
}
