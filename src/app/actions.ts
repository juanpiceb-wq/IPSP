"use server";

import { revalidatePath } from "next/cache";
import { getRepo, newId, slugify } from "@/lib/db";
import { generateMenuWithAI } from "@/lib/aiMenu";
import { validateMenu } from "@/lib/engine/validate";
import { cycleDates } from "@/lib/dates";
import { parityOfWeek, RULES } from "@/lib/rules";
import { assertCanManageExecution, assertGeneralAdmin } from "@/lib/access";
import type { Camp, ExecutionStatus, MenuItem, MenuStatus, Protein, Recipe, RestrictiveProduct, Weekday, WeeklyMenu, Zone } from "@/lib/types";

export interface GenerateRequest { year:number; week:number; campId:string; diners:number; arrival:Weekday; locked?:MenuItem[]; seed?:string; }
export interface GenerateResponse {
  items:MenuItem[]; seed:string; issues:ReturnType<typeof validateMenu>["issues"];
  metrics:ReturnType<typeof validateMenu>["metrics"]; capacityWarning:string|null; start:string; end:string;
}

export async function actionGenerate(req:GenerateRequest):Promise<GenerateResponse>{
  const repo=getRepo();const started=Date.now();
  console.log("[generate-ai] start",{campId:req.campId,year:req.year,week:req.week});
  const withTimeout=async<T>(label:string,promise:Promise<T>,ms=8000):Promise<T>=>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([promise,new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} excedió ${ms} ms`)),ms);})]);}finally{if(timer)clearTimeout(timer);}};
  const [catalog,history]=await Promise.all([withTimeout("Catálogo",repo.getCatalog()),withTimeout("Historial",repo.listMenus({campId:req.campId,limit:RULES.HISTORY_WEEKS+2}))]);
  const parity=parityOfWeek(req.week);
  const ai=await generateMenuWithAI({year:req.year,week:req.week,parity,campId:req.campId,diners:req.diners,arrival:req.arrival,catalog,history,locked:req.locked});
  const validation=validateMenu({items:ai.items,catalog,parity,arrival:req.arrival,year:req.year,week:req.week,campId:req.campId,diners:req.diners,history});
  const hard=validation.issues.filter(i=>i.level==="error");
  console.log("[generate-ai] validation-ready",{totalMs:Date.now()-started,errors:hard.length,issues:hard.map(i=>i.rule)});
  if(hard.length)throw new Error(`El cierre determinístico detectó ${hard.length} regla(s) dura(s): ${hard.slice(0,3).map(i=>i.message).join(" · ")}`);
  const {start,end}=cycleDates(req.year,req.week,req.arrival);
  return{items:ai.items,seed:ai.seed,issues:validation.issues,metrics:validation.metrics,capacityWarning:null,start,end};
}

export interface BulkCampResult { campId:string; campName:string; diners:number; arrival:Weekday; shiftDays:number; errors:number; warnings:number; varietyScore:number; }

/**
 * El menú compartido vive en coordenadas del campamento base. Para cada campamento se
 * desplaza al guardar/ejecutar, pero las reglas se validan tras normalizar a la misma
 * secuencia base. Así el domingo fijo y el ciclo de abastecimiento no cambian de significado.
 */
export async function actionGenerateBulk(req:{year:number;week:number;campIds:string[];seed?:string}){
  const repo=getRepo();const [catalog,history]=await Promise.all([repo.getCatalog(),repo.listMenus({limit:RULES.HISTORY_WEEKS+2})]);
  const camps=req.campIds.map(id=>catalog.camps.find(c=>c.id===id)).filter((c):c is Camp=>!!c&&c.active);
  if(!camps.length)throw new Error("Seleccione al menos un campamento activo.");
  const base=camps[0],parity=parityOfWeek(req.week);
  console.log("[generate-ai-bulk] start",{camps:camps.length,year:req.year,week:req.week,baseArrival:base.reception_weekday_default});
  const ai=await generateMenuWithAI({year:req.year,week:req.week,parity,campId:base.id,diners:base.diners_default,arrival:base.reception_weekday_default,catalog,history});
  const campResults:BulkCampResult[]=[];const hardMessages=new Set<string>();
  for(const camp of camps){
    const shiftDays=weekdayShift(base.reception_weekday_default,camp.reception_weekday_default);
    const v=validateMenu({items:ai.items,catalog,parity,arrival:base.reception_weekday_default,year:req.year,week:req.week,campId:camp.id,diners:camp.diners_default,history});
    v.issues.filter(i=>i.level==="error").forEach(i=>hardMessages.add(i.message));
    campResults.push({campId:camp.id,campName:camp.name,diners:camp.diners_default,arrival:camp.reception_weekday_default,shiftDays,errors:v.metrics.errors,warnings:v.metrics.warnings,varietyScore:v.metrics.varietyScore});
  }
  const primary=validateMenu({items:ai.items,catalog,parity,arrival:base.reception_weekday_default,year:req.year,week:req.week,campId:base.id,diners:base.diners_default,history});
  const totalErrors=campResults.reduce((s,r)=>s+r.errors,0);
  console.log("[generate-ai-bulk] ready",{camps:camps.length,totalErrors,issues:[...hardMessages]});
  if(totalErrors)throw new Error(`El cierre determinístico no entregará un menú inválido. Persisten ${hardMessages.size} regla(s): ${[...hardMessages].slice(0,3).join(" · ")}`);
  return{items:ai.items,seed:ai.seed,issues:primary.issues,metrics:primary.metrics,capacityWarning:null,campResults};
}

export async function actionValidateBulk(req:{year:number;week:number;campIds:string[];items:MenuItem[]}){
  const repo=getRepo();const [catalog,history]=await Promise.all([repo.getCatalog(),repo.listMenus()]);const parity=parityOfWeek(req.week);
  const camps=req.campIds.map(id=>catalog.camps.find(c=>c.id===id)).filter((c):c is Camp=>!!c&&c.active);if(!camps.length)throw new Error("Seleccione al menos un campamento activo.");
  const base=camps[0];const campResults:BulkCampResult[]=[];
  for(const camp of camps){
    const shiftDays=weekdayShift(base.reception_weekday_default,camp.reception_weekday_default);
    const v=validateMenu({items:req.items,catalog,parity,arrival:base.reception_weekday_default,year:req.year,week:req.week,campId:camp.id,diners:camp.diners_default,history});
    campResults.push({campId:camp.id,campName:camp.name,diners:camp.diners_default,arrival:camp.reception_weekday_default,shiftDays,errors:v.metrics.errors,warnings:v.metrics.warnings,varietyScore:v.metrics.varietyScore});
  }
  const validation=validateMenu({items:req.items,catalog,parity,arrival:base.reception_weekday_default,year:req.year,week:req.week,campId:base.id,diners:base.diners_default,history});
  return{issues:validation.issues,metrics:validation.metrics,campResults};
}

export async function actionValidate(req:{items:MenuItem[];year:number;week:number;campId:string;arrival:Weekday;diners?:number;scheduleShiftDays?:number}){
  const repo=getRepo();const [catalog,history]=await Promise.all([repo.getCatalog(),repo.listMenus()]);const camp=catalog.camps.find(c=>c.id===req.campId);const shift=req.scheduleShiftDays??0;
  return validateMenu({items:shift?shiftMenuItems(req.items,-shift):req.items,catalog,parity:parityOfWeek(req.week),arrival:shift?shiftWeekday(req.arrival,-shift):req.arrival,year:req.year,week:req.week,campId:req.campId,diners:req.diners??camp?.diners_default??100,history});
}

export async function actionSaveMenu(menu:{id?:string;year:number;week:number;campId:string;diners:number;arrival:Weekday;items:MenuItem[];status:MenuStatus;notes:string|null;seed:string|null;start:string|null;end:string|null;validationScore:number;varietyScore:number;scheduleShiftDays?:number}):Promise<string>{
  const repo=getRepo();const id=menu.id??newId("menu");
  if(menu.status==="aprobado"){
    const [catalog,history]=await Promise.all([repo.getCatalog(),repo.listMenus()]);const shift=menu.scheduleShiftDays??0;
    const validation=validateMenu({items:shift?shiftMenuItems(menu.items,-shift):menu.items,catalog,parity:parityOfWeek(menu.week),arrival:shift?shiftWeekday(menu.arrival,-shift):menu.arrival,year:menu.year,week:menu.week,campId:menu.campId,diners:menu.diners,history:history.filter(m=>m.id!==menu.id)});
    if(validation.metrics.errors>0)throw new Error(`El menú tiene ${validation.metrics.errors} error(es) de reglas y no puede aprobarse.`);
  }
  const record:WeeklyMenu={id,year:menu.year,week_number:menu.week,parity:parityOfWeek(menu.week),camp_id:menu.campId,diners:menu.diners,supply_arrival_weekday:menu.arrival,actual_start_date:menu.start,actual_end_date:menu.end,status:menu.status,validation_score:menu.validationScore,variety_score:menu.varietyScore,seed:menu.seed,notes:menu.notes,created_at:new Date().toISOString(),schedule_shift_days:menu.scheduleShiftDays??0,items:menu.items.map(i=>({execution_status:"pending",replacement_name:null,...i}))};
  await repo.saveMenu(record);revalidatePath("/menus");revalidatePath("/");return id;
}

export async function actionSaveBulkMenus(req:{year:number;week:number;campIds:string[];items:MenuItem[];status:MenuStatus;seed:string|null}){
  const repo=getRepo();const [catalog,history]=await Promise.all([repo.getCatalog(),repo.listMenus()]);const parity=parityOfWeek(req.week);
  const camps=req.campIds.map(id=>catalog.camps.find(c=>c.id===id)).filter((c):c is Camp=>!!c&&c.active);if(!camps.length)throw new Error("Seleccione al menos un campamento activo.");
  const saved:{campId:string;menuId:string}[]=[];const base=camps[0];
  for(const camp of camps){
    const shiftDays=weekdayShift(base.reception_weekday_default,camp.reception_weekday_default);const shiftedItems=shiftMenuItems(req.items,shiftDays);
    // Se valida en coordenadas base; al reabrir/aprobar se normaliza con schedule_shift_days.
    const validation=validateMenu({items:req.items,catalog,parity,arrival:base.reception_weekday_default,year:req.year,week:req.week,campId:camp.id,diners:camp.diners_default,history});
    if(req.status==="aprobado"&&validation.metrics.errors>0)throw new Error(`${camp.name} tiene ${validation.metrics.errors} error(es) de reglas.`);
    const {start,end}=cycleDates(req.year,req.week,camp.reception_weekday_default);const menuId=newId("menu");
    await repo.saveMenu({id:menuId,year:req.year,week_number:req.week,parity,camp_id:camp.id,diners:camp.diners_default,supply_arrival_weekday:camp.reception_weekday_default,actual_start_date:start,actual_end_date:end,status:req.status,validation_score:validation.metrics.complianceScore,variety_score:validation.metrics.varietyScore,seed:req.seed,notes:`Menú compartido base ${base.name}; desplazamiento ${shiftDays} día(s) según recepción de víveres.`,created_at:new Date().toISOString(),schedule_shift_days:shiftDays,items:shiftedItems.map(i=>({...i,execution_status:"pending",replacement_name:null}))});
    saved.push({campId:camp.id,menuId});
  }
  revalidatePath("/menus");revalidatePath("/");return saved;
}

export async function actionSetStatus(id:string,status:MenuStatus){
  const repo=getRepo();if(status==="aprobado"){
    const [menu,catalog,history]=await Promise.all([repo.getMenu(id),repo.getCatalog(),repo.listMenus()]);if(!menu)throw new Error("Menú no encontrado.");if(menuStarted(menu))throw new Error("La semana ya inició. El estado del menú está bloqueado.");
    const shift=menu.schedule_shift_days??0;const validation=validateMenu({items:shift?shiftMenuItems(menu.items,-shift):menu.items,catalog,parity:parityOfWeek(menu.week_number),arrival:shift?shiftWeekday(menu.supply_arrival_weekday,-shift):menu.supply_arrival_weekday,year:menu.year,week:menu.week_number,campId:menu.camp_id,diners:menu.diners,history:history.filter(m=>m.id!==menu.id)});
    if(validation.metrics.errors>0)throw new Error(`El menú tiene ${validation.metrics.errors} error(es) críticos y no puede aprobarse.`);
  }
  await repo.setMenuStatus(id,status);revalidatePath("/menus");revalidatePath(`/menus/${id}`);revalidatePath("/");
}

export async function actionDeleteMenu(id:string){assertGeneralAdmin();const repo=getRepo();const menu=await repo.getMenu(id);if(!menu)return;if(menuStarted(menu))throw new Error("No se puede eliminar un menú una vez iniciada su semana.");await repo.deleteMenu(id);revalidatePath("/menus");revalidatePath("/");}
export async function actionDuplicateMenu(id:string,year:number,week:number){const repo=getRepo();const src=await repo.getMenu(id);if(!src)throw new Error("No se encontró el menú a duplicar.");const newIdValue=newId("menu");const {start,end}=cycleDates(year,week,src.supply_arrival_weekday);await repo.saveMenu({...src,id:newIdValue,year,week_number:week,parity:parityOfWeek(week),status:"borrador",actual_start_date:start,actual_end_date:end,created_at:new Date().toISOString(),notes:`Duplicado de la semana ${src.week_number}. Revalide las reglas de la nueva semana.`,schedule_shift_days:0,items:src.items.map(i=>({...i,locked:false,execution_status:"pending",replacement_name:null}))});revalidatePath("/menus");return newIdValue;}

function ensureExecutionAdmin(){assertCanManageExecution();}
export async function actionSetExecutionItem(req:{menuId:string;weekday:Weekday;service:"breakfast"|"lunch"|"dinner";component:"main"|"soup";field?:"main"|"salad"|"beverage";status:ExecutionStatus}){ensureExecutionAdmin();const repo=getRepo();const menu=await repo.getMenu(req.menuId);if(!menu)throw new Error("Menú no encontrado.");const field=req.field??"main";menu.items=menu.items.map(i=>{if(i.weekday!==req.weekday||i.service!==req.service||i.component!==req.component)return i;if(field==="salad")return{...i,salad_execution_status:req.status};if(field==="beverage")return{...i,beverage_execution_status:req.status};return{...i,execution_status:req.status,replacement_name:null};});await repo.saveMenu(menu);revalidatePath("/");revalidatePath(`/menus/${req.menuId}`);}
export async function actionMarkMenuExecution(menuId:string,status:Exclude<ExecutionStatus,"pending">){ensureExecutionAdmin();const repo=getRepo();const menu=await repo.getMenu(menuId);if(!menu)throw new Error("Menú no encontrado.");menu.items=menu.items.map(i=>i.component==="main"?{...i,execution_status:status,replacement_name:status==="replaced"?"Reemplazado":null}:i);await repo.saveMenu(menu);revalidatePath("/");revalidatePath(`/menus/${menuId}`);}

export async function actionSaveRecipe(recipe:Recipe&{isNew?:boolean}){const repo=getRepo();const id=recipe.isNew||!recipe.id?uniqueId(slugify(recipe.name)):recipe.id;const {isNew,...rest}=recipe;await repo.upsertRecipe({...rest,id});revalidatePath("/preparaciones");revalidatePath("/generar");return id;}
export async function actionSaveProtein(protein:Protein){await getRepo().upsertProtein(protein);revalidatePath("/proteinas");revalidatePath("/reglas");revalidatePath("/generar");}
export async function actionSaveProduct(product:RestrictiveProduct&{isNew?:boolean}){const repo=getRepo();const id=product.isNew||!product.id?uniqueId(slugify(product.name)):product.id;const {isNew,...rest}=product;await repo.upsertProduct({...rest,id});revalidatePath("/productos");revalidatePath("/generar");}
export async function actionSaveCamp(camp:Camp&{isNew?:boolean}){const repo=getRepo();const id=camp.isNew||!camp.id?uniqueId(slugify(camp.name)):camp.id;const {isNew,...rest}=camp;await repo.upsertCamp({...rest,id});revalidatePath("/campamentos");revalidatePath("/generar");}
export async function actionDeleteCamp(id:string){assertGeneralAdmin();const repo=getRepo();const menus=await repo.listMenus({campId:id});if(menus.length)throw new Error("No se puede eliminar un campamento con menús históricos. Desactívelo para conservar trazabilidad.");await repo.deleteCamp(id);revalidatePath("/campamentos");revalidatePath("/generar");}
export async function actionSaveZone(zone:Zone&{isNew?:boolean}){const repo=getRepo();const id=zone.isNew||!zone.id?uniqueId(slugify(zone.name)):zone.id;const {isNew,...rest}=zone;await repo.upsertZone({...rest,id});revalidatePath("/campamentos");revalidatePath("/generar");revalidatePath("/");return id;}
export async function actionDeleteZone(id:string){assertGeneralAdmin();await getRepo().deleteZone(id);revalidatePath("/campamentos");revalidatePath("/generar");revalidatePath("/");}

function shiftWeekday(day:Weekday,delta:number):Weekday{return(((day+delta)%7+7)%7) as Weekday;}
function weekdayShift(baseArrival:Weekday,targetArrival:Weekday){let delta=targetArrival-baseArrival;if(delta>3)delta-=7;if(delta< -3)delta+=7;return delta;}
function shiftMenuItems(items:MenuItem[],delta:number):MenuItem[]{if(!delta)return items.map(i=>({...i}));return items.map(i=>({...i,weekday:shiftWeekday(i.weekday,delta)}));}
function menuStarted(menu:WeeklyMenu){if(!menu.actual_start_date)return false;const today=new Date();const ymd=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;return ymd>=menu.actual_start_date;}
function uniqueId(base:string){return`${base||"item"}-${Math.random().toString(36).slice(2,6)}`;}
