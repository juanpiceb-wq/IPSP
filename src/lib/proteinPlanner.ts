import type { Catalog, MainService, MenuItem, Parity, Weekday } from "./types";
import { RULES, cycleDistance, cycleOrder } from "./rules";

type EligibleSlot={weekday:number;service:string;component:string;ids:string[]};
export type ProteinSlot={weekday:Weekday;service:MainService;proteinId:string};

/**
 * Distribuye primero las 21 cuotas exactas de proteína. Esta fase no elige recetas:
 * solo garantiza la estructura semanal antes de pedir una preparación concreta.
 */
export function buildExactProteinPlan(args:{catalog:Catalog;parity:Parity;arrival:Weekday;eligibleBySlot:EligibleSlot[];locked?:MenuItem[]}):ProteinSlot[]{
 const {catalog,parity,arrival,eligibleBySlot}=args;
 const recipeById=new Map(catalog.recipes.map(r=>[r.id,r]));
 const proteinById=new Map(catalog.proteins.map(p=>[p.id,p]));
 const targets=new Map(catalog.proteins
   .filter(p=>p.active&&!p.soup_only&&p.target_frequency>0&&(p.parity==="todas"||p.parity===parity))
   .map(p=>[p.id,p.target_frequency]));
 const total=[...targets.values()].reduce((a,b)=>a+b,0);
 if(total!==21) throw new Error(`Las frecuencias exactas de proteínas suman ${total}; deben sumar exactamente 21 platos fuertes.`);

 const lockedMap=new Map((args.locked??[])
   .filter(x=>x.locked&&x.component==="main"&&x.protein_id)
   .map(x=>[`${x.weekday}|${x.service}`,x.protein_id!]));
 const slots=eligibleBySlot.filter(x=>x.component==="main").map(x=>{
   const proteins=[...new Set(x.ids.map(id=>recipeById.get(id)?.primary_protein_id)
     .filter((id):id is string=>!!id&&targets.has(id)))];
   const locked=lockedMap.get(`${x.weekday}|${x.service}`);
   return {weekday:x.weekday as Weekday,service:x.service as MainService,proteins:locked?[locked]:proteins};
 });
 if(slots.length!==21) throw new Error(`Se esperaban 21 espacios de platos fuertes y se encontraron ${slots.length}.`);
 for(const s of slots) if(!s.proteins.length) throw new Error(`No hay proteína elegible para weekday=${s.weekday}, service=${s.service}.`);

 const cycle=cycleOrder(arrival);
 const firstCycleDay=cycle[0];
 const pos=new Map(cycle.map((d,i)=>[d,i]));
 slots.sort((a,b)=>a.proteins.length-b.proteins.length || (pos.get(a.weekday)??0)-(pos.get(b.weekday)??0));
 const remaining=new Map(targets);
 const assigned=new Map<string,string>();
 const dayProteins=new Map<Weekday,Set<string>>();
 const dayOrigins=new Map<Weekday,Map<string,number>>();
 let porkExceptionUsed=0;

 const adjacent=(pid:string,day:Weekday)=>{
   if(pid==="huevo") return false;
   for(const [key,other] of assigned){
     if(other!==pid) continue;
     const otherDay=Number(key.split("|")[0]) as Weekday;
     if(cycleDistance(otherDay,day,arrival)<=RULES.MIN_PROTEIN_GAP_DAYS) return true;
   }
   return false;
 };
 const chickenOnFirstDay=()=>[...assigned.entries()].some(([key,pid])=>pid==="pollo"&&Number(key.split("|")[0])===firstCycleDay);
 const existingPorkService=(day:Weekday):MainService|null=>{
   for(const [key,pid] of assigned){
     const [d,service]=key.split("|");
     if(Number(d)!==day||pid==="chorizo")continue;
     if(proteinById.get(pid)?.origin==="cerdo")return service as MainService;
   }
   return null;
 };
 const canPlace=(pid:string,s:{weekday:Weekday;service:MainService})=>{
   if((remaining.get(pid)??0)<=0)return false;
   if(dayProteins.get(s.weekday)?.has(pid))return false;
   if(adjacent(pid,s.weekday))return false;
   const protein=proteinById.get(pid); if(!protein)return false;
   if(pid==="chorizo")return true;
   const n=dayOrigins.get(s.weekday)?.get(protein.origin)??0;
   if(n===0)return true;
   if(protein.origin==="cerdo"&&n===1&&porkExceptionUsed<1){
     const otherService=existingPorkService(s.weekday);
     return !!otherService&&new Set([otherService,s.service]).has("breakfast")&&new Set([otherService,s.service]).has("dinner")&&otherService!==s.service;
   }
   return false;
 };
 const place=(pid:string,s:{weekday:Weekday;service:MainService})=>{
   assigned.set(`${s.weekday}|${s.service}`,pid);
   remaining.set(pid,(remaining.get(pid)??0)-1);
   const ps=dayProteins.get(s.weekday)??new Set<string>();ps.add(pid);dayProteins.set(s.weekday,ps);
   if(pid!=="chorizo"){
     const origin=proteinById.get(pid)!.origin;
     const os=dayOrigins.get(s.weekday)??new Map<string,number>();
     const old=os.get(origin)??0;os.set(origin,old+1);dayOrigins.set(s.weekday,os);
     if(origin==="cerdo"&&old===1)porkExceptionUsed++;
   }
 };
 const unplace=(pid:string,s:{weekday:Weekday;service:MainService})=>{
   assigned.delete(`${s.weekday}|${s.service}`);
   remaining.set(pid,(remaining.get(pid)??0)+1);
   dayProteins.get(s.weekday)?.delete(pid);
   if(pid!=="chorizo"){
     const origin=proteinById.get(pid)!.origin;
     const os=dayOrigins.get(s.weekday)!;
     const old=os.get(origin)??1;
     if(origin==="cerdo"&&old===2)porkExceptionUsed--;
     if(old<=1)os.delete(origin);else os.set(origin,old-1);
   }
 };
 const feasible=()=>{
   for(const [pid,n] of remaining){
     if(n<=0)continue;
     let capacity=0;
     for(const s of slots){
       if(assigned.has(`${s.weekday}|${s.service}`))continue;
       if(s.proteins.includes(pid))capacity++;
     }
     if(capacity<n)return false;
   }
   if(!chickenOnFirstDay()){
     if((remaining.get("pollo")??0)<=0)return false;
     const possible=slots.some(s=>s.weekday===firstCycleDay&&!assigned.has(`${s.weekday}|${s.service}`)&&s.proteins.includes("pollo"));
     if(!possible)return false;
   }
   return true;
 };
 const solve=(i:number):boolean=>{
   if(i===slots.length)return [...remaining.values()].every(n=>n===0)&&chickenOnFirstDay();
   const s=slots[i], key=`${s.weekday}|${s.service}`;
   if(assigned.has(key))return solve(i+1);
   const options=s.proteins.filter(pid=>canPlace(pid,s)).sort((a,b)=>{
     if(s.weekday===firstCycleDay&&a==="pollo"&&b!=="pollo")return -1;
     if(s.weekday===firstCycleDay&&b==="pollo"&&a!=="pollo")return 1;
     return (remaining.get(b)??0)-(remaining.get(a)??0);
   });
   for(const pid of options){place(pid,s);if(feasible()&&solve(i+1))return true;unplace(pid,s);}
   return false;
 };
 if(!solve(0))throw new Error("No existe una distribución válida de las 21 proteínas con las cuotas y reglas actuales, incluyendo Pollo en el primer día posterior a recepción, separación entre días contiguos y la repetición diaria de cerdo únicamente en desayuno + cena.");
 return [...assigned.entries()].map(([key,proteinId])=>{const [d,s]=key.split("|");return{weekday:Number(d) as Weekday,service:s as MainService,proteinId};});
}