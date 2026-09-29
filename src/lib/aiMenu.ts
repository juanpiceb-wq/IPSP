import type { Catalog, MainService, MenuItem, Parity, Weekday, WeeklyMenu } from "./types";
import { beverageLabel } from "./rules";
import { blockingReason, buildContext, buildHistoryIndex } from "./engine/context";
import { mainAllowsSalad, saladAllowedForMain } from "./salads";
interface AiMenuInput { year:number; week:number; parity:Parity; campId:string; diners:number; arrival:Weekday; catalog:Catalog; history:WeeklyMenu[]; locked?:MenuItem[]; currentItems?:MenuItem[]; repairIssues?:string[]; }
interface AiChoice { weekday:number; service:MainService; component:"main"|"soup"; recipe_id:string; salad_recipe_id:string|null; }
export async function generateMenuWithAI(input:AiMenuInput):Promise<{items:MenuItem[];seed:string}>{
 const apiKey=process.env.OPENAI_API_KEY;if(!apiKey) throw new Error("OPENAI_API_KEY no está configurada en el servidor.");
 const recipes=input.catalog.recipes.filter(r=>r.active).map(r=>({id:r.id,name:r.name,protein:r.primary_protein_id,services:r.services,base:r.base_ingredient??null,difficulty:r.difficulty??1,sunday_roast:!!r.sunday_roast,fixed_weekday:r.fixed_weekday??null,fixed_service:r.fixed_service??null,only_weekday:r.only_weekday??null,products:r.restrictive_product_ids}));
 const proteins=input.catalog.proteins.filter(p=>p.active).map(p=>({id:p.id,name:p.name,origin:p.origin,max:p.target_frequency,breakfast_only:p.breakfast_only,soup_only:p.soup_only,parity:p.parity}));
 const recent=input.history.slice(0,8).map(m=>m.items.filter(i=>i.recipe_id).map(i=>i.recipe_id));
 const hist=buildHistoryIndex(input.history,input.year,input.week,input.campId,input.catalog);
 const ctx=buildContext(input.catalog,input.parity,input.arrival,hist);
 const eligibleBySlot:Array<{weekday:number;service:string;component:string;ids:string[]}>=[];
 for(let d=0;d<7;d++){for(const s of ["breakfast","lunch","dinner"] as MainService[]){eligibleBySlot.push({weekday:d,service:s,component:"main",ids:input.catalog.recipes.filter(r=>r.active&&!r.services.includes("salad")&&!blockingReason(r,s,d as Weekday,ctx)).map(r=>r.id)});}if(d<6)eligibleBySlot.push({weekday:d,service:"lunch",component:"soup",ids:input.catalog.recipes.filter(r=>r.active&&!blockingReason(r,"soup",d as Weekday,ctx)).map(r=>r.id)});}
 const locked=(input.locked??[]).filter(i=>i.locked&&i.recipe_id).map(i=>({weekday:i.weekday,service:i.service,component:i.component,recipe_id:i.recipe_id,salad_recipe_id:i.salad_recipe_id}));
 const prompt=`Planifica el menú semanal IPSP usando EXCLUSIVAMENTE IDs del catálogo.
Semana ${input.week}/${input.year}, paridad ${input.parity}, recepción weekday=${input.arrival}, comensales=${input.diners}.
REGLAS DURAS:
- Exactamente 21 platos fuertes: breakfast/lunch/dinner para weekdays 0..6.
- Exactamente 6 sopas: lunch weekdays 0..5. Domingo no lleva sopa.
- Domingo lunch usa la receta fija del catálogo; domingo dinner una receta sunday_roast.
- Respeta services, fixed/only weekday, paridad, breakfast_only y soup_only.
- No repetir receta ni FAMILIA de plato en toda la semana: por ejemplo bistec de res + bistec de cerdo, dos empanadas, dos ceviches o dos chaulafanes cuentan como familia repetida.\n- Misma proteína no se repite el mismo día y debe existir al menos 1 día completo de por medio antes de volver a usarla.
- Los máximos semanales de proteínas son límites DUROS, no cuotas. Cerdo total máximo 8 servicios: fritada máximo 3, chuleta máximo 2, cuero máximo 2 y lomo de cerdo máximo 1.
- Chorizo es neutro para origen animal. Solo una excepción semanal de origen cerdo repetido en un día; otros orígenes no se repiten el mismo día.
- Pollo aparece el primer día posterior a recepción.
- El ciclo se cuenta desde el primer día posterior a recepción. Verde SOLO en los primeros 4 días del ciclo; maduro SOLO desde el día 5. Respeta además la paridad/disponibilidad de bases como mote, sardina, garbanzo y demás restricciones del catálogo.\n- No repetir ingrediente base dominante en días consecutivos del ciclo.\n- No repetir la misma salsa en el mismo día ni en días consecutivos.\n- La suma de dificultad de los 3 platos fuertes de un día no puede superar 6.
- Conserva BLOQUEADOS exactamente.
- Asigna al menos 5 ensaladas compatibles en almuerzos/cenas, usando recetas service=salad.
- Tomate, cebolla, pimiento, vegetales de refrito, condimentos y vegetales secundarios son disponibilidad SUAVE: nunca deben impedir un plato.
- Proteínas y bases estructurales (verde, maduro, papa, queso y equivalentes principales) sí son importantes.
- Busca variedad y evita preparaciones recientes.
SOPAS: procura 1 pata/costilla, 2 hueso carnudo, 1 crema, 1 menestrón y 1 sin proteína.
PROTEINAS=${JSON.stringify(proteins)}
CATALOGO=${JSON.stringify(recipes)}
OPCIONES_VALIDAS_POR_ESPACIO=${JSON.stringify(eligibleBySlot)}
Para cada espacio DEBES elegir recipe_id únicamente de ids de OPCIONES_VALIDAS_POR_ESPACIO para ese weekday/service/component.
BLOQUEADOS=${JSON.stringify(locked)}
RECIENTES=${JSON.stringify(recent)}\n${input.currentItems?.length?`MODO REPARACION: corrige el menú actual cambiando únicamente lo necesario para eliminar estos incumplimientos. Mantén los demás espacios siempre que sea posible. MENÚ_ACTUAL=${JSON.stringify(input.currentItems.map(i=>({weekday:i.weekday,service:i.service,component:i.component,recipe_id:i.recipe_id,salad_recipe_id:i.salad_recipe_id})))} INCUMPLIMIENTOS=${JSON.stringify((input.repairIssues??[]).slice(0,80))}`:""}`;
 const recipeIds=recipes.map(r=>r.id);
 const saladIds=input.catalog.recipes.filter(r=>r.active&&r.services.includes("salad")).map(r=>r.id);
 const schema={type:"object",additionalProperties:false,required:["items"],properties:{items:{type:"array",minItems:27,maxItems:27,items:{type:"object",additionalProperties:false,required:["weekday","service","component","recipe_id","salad_recipe_id"],properties:{weekday:{type:"integer",minimum:0,maximum:6},service:{type:"string",enum:["breakfast","lunch","dinner"]},component:{type:"string",enum:["main","soup"]},recipe_id:{type:"string",enum:recipeIds},salad_recipe_id:{anyOf:[{type:"string",enum:saladIds},{type:"null"}]}}}}}};
 const controller=new AbortController();const timeoutMs=120000;const timer=setTimeout(()=>controller.abort(),timeoutMs);
 console.log("[openai-menu] request-start",{model:process.env.OPENAI_MENU_MODEL||"gpt-5.6-luna",recipes:recipes.length,history:recent.length,timeoutMs});
 try{
  const res=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},signal:controller.signal,body:JSON.stringify({model:process.env.OPENAI_MENU_MODEL||"gpt-5.6-luna",store:false,reasoning:{effort:"medium"},input:[{role:"user",content:[{type:"input_text",text:prompt}]}],text:{format:{type:"json_schema",name:"ipsp_weekly_menu",strict:true,schema}}})});
  console.log("[openai-menu] response",{status:res.status,ok:res.ok});
  if(!res.ok) throw new Error(`OpenAI respondió ${res.status}: ${(await res.text()).slice(0,500)}`);
  const data:any=await res.json();const outputText=data.output?.flatMap((o:any)=>o.content??[]).find((x:any)=>x.type==="output_text")?.text;
  if(!outputText) throw new Error("OpenAI no devolvió un menú estructurado.");
  const parsed=JSON.parse(outputText) as {items:AiChoice[]};const recipeById=new Map(input.catalog.recipes.map(r=>[r.id,r]));
  const items:MenuItem[]=parsed.items.map(x=>{const r=recipeById.get(x.recipe_id);if(!r)throw new Error(`recipe_id inexistente: ${x.recipe_id}`);if(x.salad_recipe_id&&!recipeById.has(x.salad_recipe_id))throw new Error(`salad_recipe_id inexistente: ${x.salad_recipe_id}`);let saladId=x.component==="main"?x.salad_recipe_id:null;if(saladId&&(x.service==="lunch"||x.service==="dinner")){const salad=recipeById.get(saladId);if(!mainAllowsSalad(r)||!salad||!saladAllowedForMain(r,salad))saladId=null;}else saladId=null;return{weekday:x.weekday as Weekday,service:x.service,component:x.component,recipe_id:x.recipe_id,protein_id:r.primary_protein_id,salad_recipe_id:saladId,beverage:x.component==="main"?beverageLabel(x.service,input.parity):null,locked:false,reasons:["Propuesto por IA y verificado por el validador IPSP."],execution_status:"pending",replacement_name:null};});
  const salads=input.catalog.recipes.filter(r=>r.active&&r.services.includes("salad"));
  let saladCount=items.filter(i=>(i.service==="lunch"||i.service==="dinner")&&!!i.salad_recipe_id).length;
  for(const item of items){if(saladCount>=5)break;if(item.component!=="main"||(item.service!=="lunch"&&item.service!=="dinner")||item.salad_recipe_id||!item.recipe_id)continue;const main=recipeById.get(item.recipe_id);if(!main||!mainAllowsSalad(main))continue;const salad=salads.find(s=>saladAllowedForMain(main,s));if(salad){item.salad_recipe_id=salad.id;saladCount++;}}
  return{items,seed:`ai-${Date.now()}`};
 }catch(err:any){
  if(err?.name==="AbortError"){console.error("[openai-menu] timeout",{timeoutMs});throw new Error(`OpenAI no respondió en ${timeoutMs/1000} segundos. Intente nuevamente.`);}
  console.error("[openai-menu] error",err instanceof Error?err.message:String(err));throw err;
 }finally{clearTimeout(timer);}
}