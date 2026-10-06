import Header from "@/components/Header";
import { getRepo } from "@/lib/db";
import { RULES } from "@/lib/rules";

export const dynamic="force-dynamic";
export default async function ReglasPage(){
  const catalog=await getRepo().getCatalog();
  const breakfastOnly=catalog.proteins.filter(p=>p.active&&p.breakfast_only);
  const soupOnly=catalog.proteins.filter(p=>p.active&&p.soup_only);
  const par=catalog.products.filter(p=>p.active&&p.parity==="par");
  const impar=catalog.products.filter(p=>p.active&&p.parity==="impar");
  const total=(parity:"par"|"impar")=>catalog.proteins.filter(p=>p.active&&!p.soup_only&&p.target_frequency>0&&(p.parity==="todas"||p.parity===parity)).reduce((s,p)=>s+p.target_frequency,0);
  return <><Header title="Reglas del sistema" subtitle="Una sola fuente de verdad para generación, validación y edición manual."/><div className="space-y-5 p-7">
    <section className={`card p-5 ${total("par")===21&&total("impar")===21?"":"border-red-300"}`}><h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-corp-700">Cuotas exactas de proteína</h2><p className="text-[13px]">Semana par: <strong>{total("par")}/21</strong> · semana impar: <strong>{total("impar")}/21</strong>. Cada proteína activa debe aparecer exactamente su frecuencia configurada; ni por encima ni por debajo.</p></section>
    <div className="grid gap-4 md:grid-cols-2">
      <Block title="Solo desayuno"><ul className="list-disc pl-5">{breakfastOnly.map(p=><li key={p.id}>{p.name}{p.parity!=="todas"?` · semana ${p.parity}`:""}</li>)}</ul><p className="mt-2 text-[12px] text-muted">Huevo puede repetirse en días consecutivos. Atún no.</p></Block>
      <Block title="Proteínas de sopa"><ul className="list-disc pl-5">{soupOnly.map(p=><li key={p.id}>{p.name} · exactamente {p.target_frequency} vez/veces cuando aplica</li>)}</ul><p className="mt-2 text-[12px] text-muted">Estas frecuencias se cuentan dentro de las 6 sopas y nunca consumen cupos de los 21 platos fuertes.</p></Block>
      <Block title="Productos semana par"><div className="flex flex-wrap gap-1.5">{par.map(p=><span key={p.id} className="badge bg-navy-800 text-white">{p.name}</span>)}</div></Block>
      <Block title="Productos semana impar"><div className="flex flex-wrap gap-1.5">{impar.map(p=><span key={p.id} className="badge bg-corp-500 text-white">{p.name}</span>)}</div></Block>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <Block title="Reglas duras"><ul className="list-disc space-y-1 pl-5">
        <li>Exactamente 21 platos fuertes y 6 sopas de lunes a sábado; domingo sin sopa.</li>
        <li>Las frecuencias semanales de proteína son exactas. El motor primero distribuye proteínas y luego elige preparaciones.</li>
        <li>La proteína se toma exclusivamente de <code>primary_protein_id</code>; nunca se deduce por el nombre del plato.</li>
        <li>No se repite la misma preparación exacta durante la semana. Dos preparaciones distintas de una misma familia sí pueden utilizarse.</li>
        <li>No se repite la misma proteína dos veces en un mismo día. Salvo Huevo, debe existir al menos un día completo entre repeticiones.</li>
        <li>Chorizo es neutro para origen animal, pero tampoco puede aparecer en días consecutivos.</li>
        <li>Solo una vez por semana pueden coincidir dos platos fuertes de origen cerdo el mismo día; nunca tres. Los demás orígenes no se repiten el mismo día.</li>
        <li>Pollo aparece obligatoriamente el primer día posterior a la recepción de víveres.</li>
        <li>Huevo y Atún solo desayuno. Sardina solo almuerzo, salvo Corviche de sardina en desayuno.</li>
        <li>El almuerzo del domingo es Ceviche de pescado con chifle. La cena del domingo debe ser asada; las preparaciones marcadas como asado dominical no se usan otro día.</li>
        <li>Plátano verde solo en los primeros {RULES.GREEN_PLANTAIN_DAYS} días del ciclo; maduro desde el día {RULES.GREEN_PLANTAIN_DAYS+1}. El chifle dominical conserva su excepción operativa.</li>
        <li>La dificultad de desayuno + almuerzo + cena no supera {RULES.MAX_DAILY_DIFFICULTY} por día.</li>
        <li>Se permite una sola coincidencia semanal de ingrediente base dominante entre días consecutivos.</li>
        <li>No se repite la misma salsa el mismo día ni en días consecutivos.</li>
        <li>Al menos {RULES.SALAD_MIN} de {RULES.SALAD_SERVICES} almuerzos/cenas llevan ensalada compatible.</li>
      </ul></Block>
      <Block title="Preferencias / información"><ul className="list-disc space-y-1 pl-5">
        <li>La composición de sopas (crema, menestrón, etc.) es una preferencia y nunca invalida por sí sola el menú.</li>
        <li>La distribución de ensaladas entre días es una preferencia.</li>
        <li>Stock, consumo físico y cantidades de ingredientes son informativos; no sustituyen las frecuencias exactas de proteína.</li>
        <li>Tomate, cebolla, pimiento, vegetales secundarios y condimentos no bloquean un plato por cantidad.</li>
        <li>Se prioriza variedad respecto de las últimas {RULES.HISTORY_WEEKS} semanas.</li>
      </ul></Block>
    </div>
    <Block title="Arquitectura de generación"><ol className="list-decimal space-y-1 pl-5"><li>El motor comprueba que las cuotas aplicables sumen 21.</li><li>Distribuye las proteínas entre los 21 espacios respetando servicio, separación, origen y primer día.</li><li>Para cada proteína busca únicamente preparaciones estructuralmente válidas.</li><li>La IA ordena preferencias de variedad; no puede cambiar cuotas ni proteínas.</li><li>Un cierre determinístico verifica receta real, plato único, dificultad, bases y salsas antes de devolver el menú.</li><li>El validador vuelve a comprobar todo antes de aprobar.</li></ol></Block>
  </div></>;
}
function Block({title,children}:{title:string;children:React.ReactNode}){return <section className="card p-5 text-[13px] leading-relaxed text-ink"><h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-corp-700">{title}</h2>{children}</section>}
