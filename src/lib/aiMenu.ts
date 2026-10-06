import type { Catalog, MainService, MenuItem, Parity, Weekday, WeeklyMenu } from "./types";
import { blockingReason, buildContext, buildHistoryIndex } from "./engine/context";
import { buildExactProteinPlan } from "./proteinPlanner";
import { finalizeMenu, type EligibleSlot, type RecipePreference } from "./menuFinalizer";

interface AiMenuInput {
  year:number; week:number; parity:Parity; campId:string; diners:number; arrival:Weekday;
  catalog:Catalog; history:WeeklyMenu[]; locked?:MenuItem[]; currentItems?:MenuItem[];
  repairIssues?:string[]; eligibleBySlotOverride?:EligibleSlot[];
}
interface AiChoice { weekday:number; service:MainService; component:"main"|"soup"; recipe_id:string; salad_recipe_id:string|null; }

/**
 * La IA propone variedad entre candidatos ya válidos. No decide cuotas, proteína,
 * existencia de slots ni el cumplimiento final: todo eso se cierra de forma determinística.
 */
export async function generateMenuWithAI(input:AiMenuInput):Promise<{items:MenuItem[];seed:string}>{
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)throw new Error("OPENAI_API_KEY no está configurada en el servidor.");

  const recent=input.history.slice(0,8).map(m=>m.items.filter(i=>i.recipe_id).map(i=>i.recipe_id));
  const hist=buildHistoryIndex(input.history,input.year,input.week,input.campId,input.catalog);
  const ctx=buildContext(input.catalog,input.parity,input.arrival,hist);
  const eligibleBySlot:EligibleSlot[]=input.eligibleBySlotOverride
    ? input.eligibleBySlotOverride.map(s=>({...s,ids:[...s.ids]}))
    : buildEligibleSlots(input.catalog,ctx);

  const proteinPlan=buildExactProteinPlan({
    catalog:input.catalog,parity:input.parity,arrival:input.arrival,
    eligibleBySlot,locked:input.locked,
  });
  const planMap=new Map(proteinPlan.map(x=>[`${x.weekday}|${x.service}`,x.proteinId]));
  const recipeById=new Map(input.catalog.recipes.map(r=>[r.id,r]));

  for(const slot of eligibleBySlot){
    if(slot.component!=="main")continue;
    const pid=planMap.get(`${slot.weekday}|${slot.service}`);
    if(!pid)throw new Error(`No se asignó proteína a weekday=${slot.weekday}, service=${slot.service}.`);
    slot.ids=slot.ids.filter(id=>recipeById.get(id)?.primary_protein_id===pid);
    if(!slot.ids.length)throw new Error(`No hay preparación válida de ${pid} para weekday=${slot.weekday}, service=${slot.service}.`);
  }

  const recipes=input.catalog.recipes.filter(r=>r.active).map(r=>({
    id:r.id,name:r.name,protein:r.primary_protein_id,services:r.services,base:r.base_ingredient??null,
    difficulty:r.difficulty??1,sunday_roast:!!r.sunday_roast,
  }));
  const proteins=input.catalog.proteins.filter(p=>p.active).map(p=>({
    id:p.id,name:p.name,origin:p.origin,exact:p.target_frequency,breakfast_only:p.breakfast_only,soup_only:p.soup_only,parity:p.parity,
  }));
  const locked=(input.locked??[]).filter(i=>i.locked&&i.recipe_id).map(i=>({weekday:i.weekday,service:i.service,component:i.component,recipe_id:i.recipe_id}));

  const prompt=`Selecciona preparaciones variadas para un menú semanal IPSP usando EXCLUSIVAMENTE IDs permitidos.
Semana ${input.week}/${input.year}; paridad ${input.parity}; recepción weekday=${input.arrival}; comensales=${input.diners}.

IMPORTANTE: el motor YA resolvió las 21 cuotas exactas de proteína. NO cambies la proteína asignada a ningún espacio.
PLAN_PROTEINAS=${JSON.stringify(proteinPlan)}

REGLAS:
- 21 platos fuertes: desayuno, almuerzo y cena de weekdays 0..6; 6 sopas: almuerzo weekdays 0..5. Domingo no lleva sopa.
- Para proteína usa solo primary_protein_id; jamás deduzcas proteína por el nombre.
- La frecuencia target de cada proteína aplicable es EXACTA, ni más ni menos.
- No repetir la misma receta exacta durante la semana. Distintas preparaciones de una misma familia sí pueden utilizarse.
- Huevo puede aparecer en días consecutivos; las demás proteínas dejan al menos un día completo de por medio. Chorizo tampoco puede ir en días consecutivos.
- Huevo y Atún solo desayuno. Sardina solo almuerzo salvo Corviche de sardina en desayuno.
- Pollo debe aparecer el primer día posterior a recepción; esta condición ya está incorporada en PLAN_PROTEINAS.
- Domingo almuerzo: ceviche fijo. Domingo cena: preparación sunday_roast; sunday_roast no se usa fuera de esa cena.
- Solo una vez por semana pueden coincidir dos proteínas de origen cerdo en el mismo día; nunca tres. Chorizo es neutro para origen.
- Dificultad diaria de los tres platos fuertes <= 6.
- Puede existir UNA sola repetición de ingrediente base entre días consecutivos por semana.
- No repetir la misma salsa el mismo día ni en días consecutivos.
- Stock/consumo físico y vegetales secundarios son informativos: NO bloquean el menú.
- Sopas: su composición (crema, menestrón, etc.) es preferencia, no bloqueo.
- Ensaladas: mínimo 5 compatibles; su distribución es preferencia.
- Conserva bloqueados.
- Prioriza variedad frente a semanas recientes.

PROTEINAS=${JSON.stringify(proteins)}
CATALOGO=${JSON.stringify(recipes)}
OPCIONES_VALIDAS_POR_ESPACIO=${JSON.stringify(eligibleBySlot)}
Cada recipe_id debe pertenecer a los ids del mismo weekday/service/component en OPCIONES_VALIDAS_POR_ESPACIO.
BLOQUEADOS=${JSON.stringify(locked)}
RECIENTES=${JSON.stringify(recent)}
${input.currentItems?.length?`MENÚ_PREVIO=${JSON.stringify(input.currentItems.map(i=>({weekday:i.weekday,service:i.service,component:i.component,recipe_id:i.recipe_id})))}\nINCUMPLIMIENTOS_PREVIOS=${JSON.stringify((input.repairIssues??[]).slice(0,40))}`:""}`;

  const recipeIds=recipes.map(r=>r.id);
  const saladIds=input.catalog.recipes.filter(r=>r.active&&r.services.includes("salad")).map(r=>r.id);
  const schema={type:"object",additionalProperties:false,required:["items"],properties:{items:{type:"array",minItems:27,maxItems:27,items:{type:"object",additionalProperties:false,required:["weekday","service","component","recipe_id","salad_recipe_id"],properties:{weekday:{type:"integer",minimum:0,maximum:6},service:{type:"string",enum:["breakfast","lunch","dinner"]},component:{type:"string",enum:["main","soup"]},recipe_id:{type:"string",enum:recipeIds},salad_recipe_id:{anyOf:[{type:"string",enum:saladIds},{type:"null"}]}}}}}};

  const controller=new AbortController();const timeoutMs=120000;const timer=setTimeout(()=>controller.abort(),timeoutMs);
  console.log("[openai-menu] request-start",{model:process.env.OPENAI_MENU_MODEL||"gpt-5.6-luna",recipes:recipes.length,history:recent.length,timeoutMs});
  try{
    const res=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},signal:controller.signal,
      body:JSON.stringify({model:process.env.OPENAI_MENU_MODEL||"gpt-5.6-luna",store:false,reasoning:{effort:"medium"},input:[{role:"user",content:[{type:"input_text",text:prompt}]}],text:{format:{type:"json_schema",name:"ipsp_weekly_menu",strict:true,schema}}}),
    });
    console.log("[openai-menu] response",{status:res.status,ok:res.ok});
    if(!res.ok)throw new Error(`OpenAI respondió ${res.status}: ${(await res.text()).slice(0,500)}`);
    const data:any=await res.json();
    const outputText=data.output?.flatMap((o:any)=>o.content??[]).find((x:any)=>x.type==="output_text")?.text;
    if(!outputText)throw new Error("OpenAI no devolvió un menú estructurado.");
    const parsed=JSON.parse(outputText) as {items:AiChoice[]};
    const preferences:RecipePreference[]=parsed.items.map(x=>({weekday:x.weekday,service:x.service,component:x.component,recipe_id:x.recipe_id,salad_recipe_id:x.salad_recipe_id}));
    const items=finalizeMenu({catalog:input.catalog,parity:input.parity,arrival:input.arrival,eligibleBySlot,proteinPlan,preferences,locked:input.locked});
    return{items,seed:`ai-${Date.now()}`};
  }catch(err:any){
    if(err?.name==="AbortError"){console.error("[openai-menu] timeout",{timeoutMs});throw new Error(`OpenAI no respondió en ${timeoutMs/1000} segundos. Intente nuevamente.`);}
    console.error("[openai-menu] error",err instanceof Error?err.message:String(err));throw err;
  }finally{clearTimeout(timer);}
}

function buildEligibleSlots(catalog:Catalog,ctx:ReturnType<typeof buildContext>):EligibleSlot[]{
  const out:EligibleSlot[]=[];
  for(let d=0;d<7;d++){
    for(const service of ["breakfast","lunch","dinner"] as MainService[]){
      out.push({weekday:d,service,component:"main",ids:catalog.recipes.filter(r=>r.active&&!!r.primary_protein_id&&!r.services.includes("salad")&&!blockingReason(r,service,d as Weekday,ctx)).map(r=>r.id)});
    }
    if(d<6)out.push({weekday:d,service:"lunch",component:"soup",ids:catalog.recipes.filter(r=>r.active&&!blockingReason(r,"soup",d as Weekday,ctx)).map(r=>r.id)});
  }
  return out;
}
