import Header from "@/components/Header";
import { getRepo } from "@/lib/db";
import { RULES } from "@/lib/rules";

export const dynamic = "force-dynamic";

export default async function ReglasPage() {
  const catalog = await getRepo().getCatalog();
  const breakfastOnly = catalog.proteins.filter((p) => p.breakfast_only);
  const soupOnly = catalog.proteins.filter((p) => p.soup_only);
  const par = catalog.products.filter((p) => p.parity === "par");
  const impar = catalog.products.filter((p) => p.parity === "impar");

  return (
    <>
      <Header
        title="Reglas del sistema"
        subtitle="Reglas duras que el generador nunca rompe y preferencias que intenta cumplir al máximo."
      />
      <div className="space-y-5 p-7">
        <div className="grid gap-4 md:grid-cols-2">
          <Block title="Solo desayuno" tone="corp">
            <ul className="list-disc pl-5">
              {breakfastOnly.map((p) => (
                <li key={p.id}>
                  {p.name}
                  {p.parity !== "todas" ? ` · semana ${p.parity}` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-muted">
              Nunca como proteína principal de almuerzo o cena.
            </p>
          </Block>

          <Block title="Solo sopa" tone="navy">
            <ul className="list-disc pl-5">
              {soupOnly.map((p) => (
                <li key={p.id}>
                  {p.name}
                  {p.parity !== "todas" ? ` · semana ${p.parity}` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-muted">
              Ninguna otra proteína puede utilizarse en sopa. Las demás ocupan los {RULES.MAIN_SLOTS}{" "}
              platos fuertes.
            </p>
          </Block>

          <Block title="Productos de semana par">
            <div className="flex flex-wrap gap-1.5">
              {par.map((p) => (
                <span key={p.id} className="badge bg-navy-800 text-white">
                  {p.name}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-muted">
              Todo tipo de fideo o pasta se considera producto de semana par.
            </p>
          </Block>

          <Block title="Productos de semana impar">
            <div className="flex flex-wrap gap-1.5">
              {impar.map((p) => (
                <span key={p.id} className="badge bg-corp-500 text-white">
                  {p.name}
                </span>
              ))}
            </div>
          </Block>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Block title="Reglas duras (nunca se rompen)">
            <ul className="list-disc space-y-1 pl-5">
              <li>Arroz en desayuno, almuerzo y cena.</li>
              <li>Sopa en los almuerzos de lunes a sábado. El domingo no se sirve sopa.</li>
              <li>Bebidas: desayuno Café/Aromática/Chocolatada/Quaker; almuerzo Jugo de pulpa/Quaker; cena Jugo en polvo/Café. Quaker solo semana par.</li>
              <li>Huevo y atún son exclusivos de desayuno. Las demás proteínas generales pueden usarse también en desayuno. Sardina solo en almuerzo, excepto Corviche de sardina que sí puede ir en desayuno.</li>
              <li>Hueso carnudo, costilla y pata solo en sopa.</li>
              <li>Ninguna otra proteína en sopa.</li>
              <li>Producto de semana par no se usa en semana impar y viceversa.</li>
              <li>Fideos y pastas únicamente en semana par.</li>
              <li>Ningún producto se programa antes de su fecha de llegada.</li>
              <li>No se repite la misma proteína dos veces el mismo día.</li>
              <li>Se evita repetir el mismo origen animal en dos platos fuertes del mismo día. Para cerdo se permite hasta {RULES.PORK_EXCEPTIONS_ALLOWED} excepción semanal; otros orígenes solo se repiten si es necesario para completar 21/21 sin romper stock ni máximos.</li>
              <li>No se supera el máximo semanal configurado por proteína ni el stock semanal cuantificable.</li>
              <li>El almuerzo del domingo es Ceviche de pescado con chifle; la cena del domingo debe ser asada.</li>
              <li>Los platos con doble fritura solo pueden ir en cena.</li>
              <li>La dificultad de desayuno + almuerzo + cena no puede superar {RULES.MAX_DAILY_DIFFICULTY} por día.</li>
              <li>No se repite un ingrediente base dominante en días consecutivos.</li>
              <li>Plátano verde: primeros {RULES.GREEN_PLANTAIN_DAYS} días efectivos después de la recepción. Ej.: recepción martes → verde de miércoles a sábado. Después se usa maduro. El chifle dominical se reserva/procesa antes.</li>
              <li>Ensalada en {RULES.SALAD_TARGET} de {RULES.SALAD_SERVICES} almuerzos y cenas. Los platos dificultad 3 son los primeros candidatos a ir sin ensalada.</li>
            </ul>
          </Block>

          <Block title="Preferencias (se optimizan)">
            <ul className="list-disc space-y-1 pl-5">
              <li>Distribuir las proteínas buscando variedad sin superar su máximo semanal.</li>
              <li>Minimizar repetición de recetas y proteínas frente a las últimas {RULES.HISTORY_WEEKS} semanas.</li>
              <li>Minimizar especialmente la similitud con la semana inmediatamente anterior.</li>
              <li>Preferir dejar sin ensalada los platos dificultad 3 cuando sea necesario para mantener la carga operativa.</li>
              <li>Variar días y servicios respecto a semanas anteriores.</li>
            </ul>
          </Block>
        </div>

        <Block title="Ciclo real de uso">
          <p>
            El archivo del menú va de lunes a domingo, pero la ejecución sigue el abastecimiento: el
            nuevo menú empieza el día siguiente a la recepción de víveres y se utiliza durante siete
            días. Con recepción el martes, el ciclo va de miércoles a martes.
          </p>
          <p className="mt-2 text-[12px] text-muted">
            El generador usa esta secuencia para decidir qué productos ya llegaron cada día.
          </p>
        </Block>
      </div>
    </>
  );
}

function Block({
  title,
  children,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  tone?: "corp" | "navy";
}) {
  return (
    <section className="card p-5 text-[13px] leading-relaxed text-ink">
      <h2
        className={`mb-2 text-[13px] font-bold uppercase tracking-wide ${
          tone === "navy" ? "text-navy-800" : "text-corp-700"
        }`}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
