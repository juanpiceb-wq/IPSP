import { addDays, isoWeekMonday, toISODate } from "./dates";
import { cycleOrder, cyclePosition } from "./rules";
import type { MenuItem, Weekday } from "./types";

export interface OperationalDay {
  position: number;
  weekday: Weekday;
  date: string;
}

/** Día 1 es siempre el día siguiente a la recepción. */
export function operationalDays(year:number, week:number, arrival:Weekday):OperationalDay[]{
  const start=addDays(isoWeekMonday(year,week),arrival+1);
  return cycleOrder(arrival).map((weekday,index)=>({position:index+1,weekday,date:toISODate(addDays(start,index))}));
}

function weekdayAtPosition(arrival:Weekday,position:number):Weekday{
  return (((arrival+position)%7) as Weekday);
}

/**
 * Proyecta un menú maestro de un calendario de recepción a otro.
 * La secuencia Día 1..7 se conserva, salvo que el bloque dominical se intercambia
 * con la posición que corresponda para que el menú especial de domingo permanezca
 * SIEMPRE en el domingo calendario.
 */
export function projectSharedItems(items:MenuItem[],sourceArrival:Weekday,targetArrival:Weekday):MenuItem[]{
  if(sourceArrival===targetArrival)return items.map(i=>({...i}));
  const sourceSundayPos=cyclePosition(6,sourceArrival);
  const targetSundayPos=cyclePosition(6,targetArrival);
  return items.map(item=>{
    const sourcePos=cyclePosition(item.weekday,sourceArrival);
    let targetPos=sourcePos;
    if(sourcePos===sourceSundayPos)targetPos=targetSundayPos;
    else if(sourcePos===targetSundayPos)targetPos=sourceSundayPos;
    return {...item,weekday:weekdayAtPosition(targetArrival,targetPos)};
  });
}

/** Inversa de projectSharedItems para volver al calendario del maestro. */
export function normalizeSharedItems(items:MenuItem[],currentArrival:Weekday,masterArrival:Weekday):MenuItem[]{
  return projectSharedItems(items,currentArrival,masterArrival);
}
