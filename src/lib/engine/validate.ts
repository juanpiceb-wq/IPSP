import type { Catalog, MenuItem, MenuMetrics, Parity, ValidationIssue, Weekday, WeeklyMenu } from "../types";
import { RULES, allowedBeverages, cycleOrder } from "../rules";
import { WEEKDAYS } from "../types";
import { addConsumption, inventorySummary } from "../supply";
import { mainAllowsSalad, saladAllowedForMain, saladIngredientViolations } from "../salads";
import { blockingReason, buildContext, buildHistoryIndex, isMeaningfulBase, recencyWeight } from "./context";
import { adjacentSauceViolations, hasChickenOnFirstDay, soupCompositionCounts } from "../recipeRules";

export interface ValidateInput {
  items:MenuItem[]; catalog:Catalog; parity:Parity; arrival:Weekday; year:number; week:number;
  campId:string; diners:number; history:WeeklyMenu[];
}
export interface ValidationResult {
  issues:ValidationIssue[]; metrics:MenuMetrics; unmetTargets:{name:string;target:number;assigned:number}[];
}

export function validateMenu(input:ValidateInput):ValidationResult {
  const {items,catalog,parity}=input;
  const hist=buildHistoryIndex(input.history,input.year,input.week,input.campId,catalog);
  const ctx=buildContext(catalog,parity,input.arrival,hist);
  const issues:ValidationIssue[]=[];
  const mains=items.filter(i=>i.component==="main");
  const soups=items.filter(i=>i.component==="soup");
  const lunchDinner=mains.filter(i=>i.service==="lunch"||i.service==="dinner");

  // Estructura canónica: exactamente un registro por cada slot esperado.
  const expectedMain=WEEKDAYS.flatMap(d=>["breakfast","lunch","dinner"].map(s=>`${d.value}|${s}|main`));
  const expectedSoup=WEEKDAYS.filter(d=>d.value!==6).map(d=>`${d.value}|lunch|soup`);
  const slotCounts=new Map<string,number>();
  for(const i of items){const k=`${i.weekday}|${i.service}|${i.component}`;slotCounts.set(k,(slotCounts.get(k)??0)+1);}
  const missingMain=expectedMain.filter(k=>(slotCounts.get(k)??0)===0);
  const duplicateMain=expectedMain.filter(k=>(slotCounts.get(k)??0)>1);
  const missingSoup=expectedSoup.filter(k=>(slotCounts.get(k)??0)===0);
  const duplicateSoup=expectedSoup.filter(k=>(slotCounts.get(k)??0)>1);
  const sundaySoups=soups.filter(i=>i.weekday===6);
  if(missingMain.length||duplicateMain.length){
    issues.push({level:"error",rule:"estructura-platos",message:`Estructura de platos fuertes inválida: ${missingMain.length} faltante(s), ${duplicateMain.length} slot(s) duplicado(s).`});
  }else issues.push({level:"ok",rule:"estructura-platos",message:"Los 21 platos fuertes ocupan exactamente un espacio cada uno."});
  if(missingSoup.length||duplicateSoup.length||sundaySoups.length){
    issues.push({level:"error",rule:"estructura-sopas",message:`Estructura de sopas inválida: ${missingSoup.length} faltante(s), ${duplicateSoup.length} slot(s) duplicado(s), ${sundaySoups.length} sopa(s) en domingo.`});
  }else issues.push({level:"ok",rule:"estructura-sopas",message:"Hay exactamente 6 sopas de lunes a sábado y ninguna el domingo."});

  const soupMix=soupCompositionCounts(items,catalog);const soupProblems:string[]=[];
  if(soupMix.pataOCostilla<1)soupProblems.push("1 sopa de pata o costilla");
  if(soupMix.hueso<2)soupProblems.push("2 sopas con hueso carnudo");
  if(soupMix.crema<1)soupProblems.push("1 crema");
  if(soupMix.menestron<1)soupProblems.push("1 menestrón");
  if(soupMix.sinProteina<1)soupProblems.push("1 sopa sin proteína animal");
  issues.push(soupProblems.length
    ?{level:"warn",rule:"composicion-sopas",message:`Composición de sopas mejorable: falta ${soupProblems.join(", ")}. Esta regla no invalida el menú.`}
    :{level:"ok",rule:"composicion-sopas",message:"Variedad sugerida de sopas cumplida."});

  // Integridad receta ↔ proteína y elegibilidad estructural.
  let invalid=0;
  for(const it of items){
    if(!it.recipe_id){invalid++;issues.push({level:"error",rule:"receta",message:`${WEEKDAYS[it.weekday].label} · ${labelOf(it)} quedó sin preparación.`,weekday:it.weekday,service:it.service});continue;}
    const recipe=ctx.recipesById.get(it.recipe_id);
    if(!recipe){invalid++;issues.push({level:"error",rule:"receta",message:`${WEEKDAYS[it.weekday].label} · ${labelOf(it)} referencia una preparación inexistente.`,weekday:it.weekday,service:it.service});continue;}
    if(it.protein_id!==recipe.primary_protein_id){invalid++;issues.push({level:"error",rule:"integridad-proteina",message:`${recipe.name}: protein_id del menú no coincide con primary_protein_id del catálogo.`,weekday:it.weekday,service:it.service});}
    const service=it.component==="soup"?"soup":it.service;
    const reason=blockingReason(recipe,service,it.weekday,ctx);
    if(reason){invalid++;issues.push({level:"error",rule:"restriccion",message:`${WEEKDAYS[it.weekday].label} · ${labelOf(it)}: ${reason}`,weekday:it.weekday,service:it.service});}
  }
  if(!invalid)issues.push({level:"ok",rule:"restriccion",message:"Todas las preparaciones existen, tienen proteína consistente y respetan su elegibilidad estructural."});

  const firstCycleDay=cycleOrder(input.arrival)[0];
  if(!hasChickenOnFirstDay(items,input.arrival))issues.push({level:"error",rule:"pollo-primer-dia",message:`El pollo debe aparecer el primer día posterior a la recepción (${WEEKDAYS[firstCycleDay].label}).`,weekday:firstCycleDay});
  else issues.push({level:"ok",rule:"pollo-primer-dia",message:`Pollo programado en el primer día del ciclo (${WEEKDAYS[firstCycleDay].label}).`});

  const sauceProblems=adjacentSauceViolations(items,catalog,input.arrival);
  for(const v of sauceProblems)issues.push({level:"error",rule:"salsa-consecutiva",message:`${v.label}: se repite el mismo día o en días contiguos (${WEEKDAYS[v.dayA].label} / ${WEEKDAYS[v.dayB].label}).`});
  if(!sauceProblems.length)issues.push({level:"ok",rule:"salsa-consecutiva",message:"No se repite la misma salsa el mismo día ni en días contiguos."});

  const sundayLunch=mains.find(i=>i.weekday===6&&i.service==="lunch");
  if(ctx.sundayLunchRecipeId&&sundayLunch?.recipe_id!==ctx.sundayLunchRecipeId)issues.push({level:"error",rule:"domingo-almuerzo",message:"El almuerzo del domingo debe ser Ceviche de pescado con chifle."});
  else if(ctx.sundayLunchRecipeId)issues.push({level:"ok",rule:"domingo-almuerzo",message:"Almuerzo dominical fijo correcto."});
  const sundayDinner=mains.find(i=>i.weekday===6&&i.service==="dinner");
  const sundayDinnerRecipe=sundayDinner?.recipe_id?ctx.recipesById.get(sundayDinner.recipe_id):null;
  if(!sundayDinnerRecipe?.sunday_roast)issues.push({level:"error",rule:"domingo-cena",message:"La cena del domingo debe ser una preparación asada habilitada."});
  else issues.push({level:"ok",rule:"domingo-cena",message:"Cena dominical asada correcta."});

  // Solo se prohíbe repetir la preparación exacta; no se bloquean familias genéricas.
  const exact=new Map<string,MenuItem[]>();
  for(const it of items){if(!it.recipe_id)continue;const a=exact.get(it.recipe_id)??[];a.push(it);exact.set(it.recipe_id,a);}
  let exactRepeats=0;
  for(const [id,a] of exact){if(a.length<=1)continue;exactRepeats++;issues.push({level:"error",rule:"plato-exacto-repetido",message:`${ctx.recipesById.get(id)?.name??id} se repite ${a.length} veces. Una preparación exacta solo puede aparecer una vez.`});}
  if(!exactRepeats)issues.push({level:"ok",rule:"plato-exacto-repetido",message:"No se repite ninguna preparación exacta durante la semana."});

  // Proteínas de platos fuertes: mismo día y separación. Huevo es la única excepción de días consecutivos.
  for(const day of WEEKDAYS){
    const dayMains=mains.filter(i=>i.weekday===day.value&&i.protein_id);const seen=new Set<string>();
    for(const it of dayMains){if(seen.has(it.protein_id!))issues.push({level:"error",rule:"proteina-dia",message:`${day.label}: ${ctx.proteinsById.get(it.protein_id!)?.name??it.protein_id} se repite dos veces el mismo día.`,weekday:day.value});seen.add(it.protein_id!);}
  }
  const order=cycleOrder(input.arrival);const cyclePos=new Map(order.map((d,i)=>[d,i]));
  validateProteinGap(mains,ctx.proteinsById,cyclePos,issues,"main");
  validateProteinGap(soups.filter(i=>i.protein_id&&ctx.proteinsById.get(i.protein_id)?.soup_only),ctx.proteinsById,cyclePos,issues,"soup");

  // Origen animal solo para platos fuertes; chorizo es neutro. Una excepción semanal de cerdo.
  let porkExceptions=0;
  for(const day of WEEKDAYS){
    const origins=mains.filter(i=>i.weekday===day.value&&i.protein_id).map(i=>{const p=ctx.proteinsById.get(i.protein_id!);return p&&p.id!=="chorizo"?p.origin:null;}).filter(Boolean) as string[];
    const counts=new Map<string,number>();origins.forEach(o=>counts.set(o,(counts.get(o)??0)+1));
    for(const [origin,n] of counts){if(n<=1)continue;if(origin==="cerdo")porkExceptions+=n-1;else issues.push({level:"error",rule:"origen-dia",message:`${day.label}: se repite origen ${origin}. Solo existe una excepción semanal para cerdo.`,weekday:day.value});}
  }
  if(porkExceptions>RULES.PORK_EXCEPTIONS_ALLOWED)issues.push({level:"error",rule:"excepcion-cerdo",message:`Se usaron ${porkExceptions} excepciones de origen cerdo; solo se permite ${RULES.PORK_EXCEPTIONS_ALLOWED}.`});
  else if(porkExceptions)issues.push({level:"warn",rule:"excepcion-cerdo",message:`${porkExceptions} excepción de origen cerdo utilizada.`});
  else issues.push({level:"ok",rule:"excepcion-cerdo",message:"No fue necesario usar la excepción semanal de origen cerdo."});

  let maxDailyDifficulty=0;
  for(const day of WEEKDAYS){const total=mains.filter(i=>i.weekday===day.value&&i.recipe_id).reduce((s,i)=>s+(ctx.recipesById.get(i.recipe_id!)?.difficulty??1),0);maxDailyDifficulty=Math.max(maxDailyDifficulty,total);if(total>RULES.MAX_DAILY_DIFFICULTY)issues.push({level:"error",rule:"dificultad-dia",message:`${day.label}: dificultad total ${total}; máximo ${RULES.MAX_DAILY_DIFFICULTY}.`,weekday:day.value});}
  if(maxDailyDifficulty<=RULES.MAX_DAILY_DIFFICULTY)issues.push({level:"ok",rule:"dificultad-dia",message:`Ningún día supera dificultad ${RULES.MAX_DAILY_DIFFICULTY}.`});

  const basePairs:{leftDay:Weekday;rightDay:Weekday;base:string}[]=[];
  for(let p=0;p<order.length-1;p++){
    const leftDay=order[p],rightDay=order[p+1];
    const left=new Set(mains.filter(i=>i.weekday===leftDay&&i.recipe_id).map(i=>ctx.recipesById.get(i.recipe_id!)?.base_ingredient).filter((b):b is string=>isMeaningfulBase(b)));
    const right=new Set(mains.filter(i=>i.weekday===rightDay&&i.recipe_id).map(i=>ctx.recipesById.get(i.recipe_id!)?.base_ingredient).filter((b):b is string=>isMeaningfulBase(b)));
    for(const base of left)if(right.has(base))basePairs.push({leftDay,rightDay,base});
  }
  for(const x of basePairs.slice(1))issues.push({level:"error",rule:"base-consecutiva",message:`${WEEKDAYS[x.leftDay].label} → ${WEEKDAYS[x.rightDay].label}: se repite ${x.base}; ya se utilizó la única excepción semanal de base consecutiva.`});
  if(basePairs.length===0)issues.push({level:"ok",rule:"base-consecutiva",message:"No se repiten bases dominantes en días consecutivos."});
  else if(basePairs.length===1)issues.push({level:"ok",rule:"base-consecutiva",message:`Se utiliza 1/1 excepción semanal de base consecutiva (${basePairs[0].base}).`});

  // Ensaladas: mínimo 5 duro; distribución e ingredientes secundarios son aviso.
  let saladHardErrors=0;
  for(const item of lunchDinner){
    if(!item.salad_recipe_id)continue;
    const salad=catalog.recipes.find(r=>r.id===item.salad_recipe_id);const main=item.recipe_id?catalog.recipes.find(r=>r.id===item.recipe_id):null;
    if(!salad||!salad.active||!salad.services.includes("salad")){saladHardErrors++;issues.push({level:"error",rule:"ensalada-catalogo",message:`${WEEKDAYS[item.weekday].label}: ensalada inexistente o inactiva.`});continue;}
    if(main&&(!mainAllowsSalad(main)||!saladAllowedForMain(main,salad))){saladHardErrors++;issues.push({level:"error",rule:"ensalada-compatibilidad",message:`${WEEKDAYS[item.weekday].label}: ${main.name} no debe acompañarse con ${salad.name}.`});}
  }
  const saladCount=lunchDinner.filter(i=>!!i.salad_recipe_id).length;
  const saladDays=new Set(lunchDinner.filter(i=>!!i.salad_recipe_id).map(i=>i.weekday)).size;
  if(saladCount<RULES.SALAD_MIN)issues.push({level:"error",rule:"ensaladas",message:`${saladCount}/${RULES.SALAD_SERVICES} servicios con ensalada; mínimo ${RULES.SALAD_MIN}.`});
  else issues.push({level:"ok",rule:"ensaladas",message:`${saladCount}/${RULES.SALAD_SERVICES} servicios con ensalada; cumple mínimo ${RULES.SALAD_MIN}.`});
  if(saladCount>=RULES.SALAD_MIN&&saladDays<4)issues.push({level:"warn",rule:"ensaladas-distribucion",message:`Las ${saladCount} ensaladas están concentradas en ${saladDays} día(s); conviene distribuirlas mejor.`});
  const saladIngredientWarnings=saladIngredientViolations(lunchDinner);
  for(const x of saladIngredientWarnings)issues.push({level:"warn",rule:"ensalada-ingrediente",message:`${x.label}: aparece en ${x.used} ensaladas; referencia semanal ${x.max}.`});
  if(!saladHardErrors)issues.push({level:"ok",rule:"ensalada-reglas",message:"Las ensaladas asignadas son compatibles con sus platos."});

  const badBeverage=mains.filter(i=>!i.beverage||!allowedBeverages(i.service,parity).includes(i.beverage));
  if(badBeverage.length)issues.push({level:"error",rule:"bebidas",message:`${badBeverage.length} servicio(s) tienen bebida no permitida.`});
  else issues.push({level:"ok",rule:"bebidas",message:"Bebidas correctas por servicio y paridad."});
  issues.push({level:"ok",rule:"arroz",message:"Arroz se agrega por defecto salvo preparaciones con arroz integrado."});

  // Frecuencias exactas separadas por componente: main nunca se mezcla con sopa.
  let frequencyErrors=0;
  for(const p of catalog.proteins){
    if(!p.active||p.target_frequency<=0||(p.parity!=="todas"&&p.parity!==parity))continue;
    const pool=p.soup_only?soups:mains;
    const assigned=pool.filter(i=>i.protein_id===p.id).length;
    if(assigned!==p.target_frequency){frequencyErrors++;issues.push({level:"error",rule:"frecuencia",message:`${p.name}: debe aparecer exactamente ${p.target_frequency} vez/veces en ${p.soup_only?"sopas":"platos fuertes"} · asignadas ${assigned}.`});}
  }
  if(!frequencyErrors)issues.push({level:"ok",rule:"frecuencia",message:"Todas las proteínas cumplen exactamente su frecuencia semanal configurada."});

  const ledger=new Map<string,number>();
  for(const it of items){if(!it.recipe_id)continue;const r=ctx.recipesById.get(it.recipe_id);if(r)addConsumption(ledger,r,input.diners);}
  issues.push({level:"ok",rule:"stock",message:"El consumo estimado es informativo y no invalida el menú; las cuotas se controlan por frecuencia exacta de proteína."});

  const menuComplete=missingMain.length===0&&duplicateMain.length===0&&missingSoup.length===0&&duplicateSoup.length===0&&!sundaySoups.length&&items.every(i=>!!i.recipe_id);
  const variety=menuComplete?varietyScore(items,ctx.history,ctx.recipesById):0;
  issues.push(menuComplete?{level:variety>=80?"ok":"warn",rule:"variedad",message:`Variedad frente a las últimas ${RULES.HISTORY_WEEKS} semanas: ${variety}%.`}:{level:"warn",rule:"variedad",message:"La variedad no se califica hasta completar la estructura semanal."});

  const errors=issues.filter(i=>i.level==="error").length;const warnings=issues.filter(i=>i.level==="warn").length;
  const inventoryRows=inventorySummary(ledger,input.diners);const inventoryUsePct=inventoryRows.length?Math.round(inventoryRows.reduce((s,x)=>s+Math.min(100,x.pct),0)/inventoryRows.length):0;
  const metrics:MenuMetrics={mainCount:mains.filter(i=>i.recipe_id).length,soupCount:soups.filter(i=>i.recipe_id).length,saladCount,saladTarget:RULES.SALAD_TARGET,errors,warnings,varietyScore:variety,complianceScore:Math.max(0,Math.round(100-errors*12-warnings*3)),porkExceptions,maxDailyDifficulty,inventoryUsePct};
  const unmetTargets=catalog.proteins.filter(p=>p.active&&!p.soup_only&&p.target_frequency>0&&(p.parity==="todas"||p.parity===parity)).map(p=>({name:p.name,target:p.target_frequency,assigned:mains.filter(i=>i.protein_id===p.id).length})).filter(x=>x.assigned<x.target);
  return{issues,metrics,unmetTargets};
}

function validateProteinGap(items:MenuItem[],proteins:Map<string,{name:string}>,cyclePos:Map<Weekday,number>,issues:ValidationIssue[],scope:"main"|"soup"){
  const byProtein=new Map<string,Set<Weekday>>();
  for(const it of items){if(!it.recipe_id||!it.protein_id)continue;const set=byProtein.get(it.protein_id)??new Set<Weekday>();set.add(it.weekday);byProtein.set(it.protein_id,set);}
  let violations=0;
  for(const [pid,daysSet] of byProtein){if(pid==="huevo")continue;const days=[...daysSet].sort((a,b)=>(cyclePos.get(a)??0)-(cyclePos.get(b)??0));for(let i=1;i<days.length;i++){const prev=days[i-1],curr=days[i];if((cyclePos.get(curr)??0)-(cyclePos.get(prev)??0)<=RULES.MIN_PROTEIN_GAP_DAYS){violations++;issues.push({level:"error",rule:"proteina-consecutiva",message:`${WEEKDAYS[prev].label} → ${WEEKDAYS[curr].label}: ${proteins.get(pid)?.name??pid} requiere al menos 1 día completo de por medio${scope==="soup"?" entre sopas":""}.`,weekday:curr});}}}
  if(!violations&&scope==="main")issues.push({level:"ok",rule:"proteina-consecutiva",message:"Las proteínas de platos fuertes respetan su separación mínima; Huevo conserva su excepción."});
}
function labelOf(it:MenuItem){if(it.component==="soup")return"sopa";return it.service==="breakfast"?"desayuno":it.service==="lunch"?"almuerzo":"cena";}

export function varietyScore(items:MenuItem[],history:ReturnType<typeof buildHistoryIndex>,recipesById?:Map<string,{base_ingredient?:string|null}>):number{
  const relevant=items.filter(i=>i.recipe_id);if(!relevant.length)return 0;let penalty=0;
  for(const it of relevant){const ago=history.recipeAgo.get(it.recipe_id!);penalty+=recencyWeight(ago)*(ago===1?1.35:1);penalty+=recencyWeight(history.recipeSlotAgo.get(`${it.recipe_id}|${it.weekday}|${it.service}|${it.component}`))*0.8;if(it.protein_id)penalty+=recencyWeight(history.proteinSlotAgo.get(`${it.protein_id}|${it.weekday}|${it.service}`))*0.5;const base=recipesById?.get(it.recipe_id!)?.base_ingredient;if(isMeaningfulBase(base))penalty+=recencyWeight(history.baseAgo.get(base!))*0.35;}
  return Math.max(0,Math.round(100-(penalty/(relevant.length*3))*100));
}

/** Stock físico nunca bloquea una selección; se conserva la API para el selector manual. */
export function menuStockReason(_items:MenuItem[],_candidate:{recipe_id:string|null},_catalog:Catalog,_diners:number){return null;}
