import type { Camp, Protein } from "../types";

/**
 * El seed histórico se conserva para trazabilidad, pero el modo demo/pruebas debe usar
 * las mismas reglas operativas que producción. Las recetas reales viven en Supabase.
 */
export function currentProteinOverrides(proteins:Protein[]):Protein[]{
  return proteins.map(p=>{
    if(p.id==="chorizo")return{...p,target_frequency:2,portion_type:"per_person",portion_value:1,portion_unit:"unidad",portion_label:"1 chorizo por persona"};
    if(p.id==="cuero-cerdo")return{...p,target_frequency:1,portion_type:"per_person",portion_value:100,portion_unit:"gramo",portion_label:"100 g por persona"};
    if(p.id==="carne-molida")return{...p,portion_type:"per_person",portion_value:100,portion_unit:"gramo",portion_label:"100 g por persona"};
    if(p.id==="costilla-res")return{...p,portion_type:"per_person",portion_value:110,portion_unit:"gramo",portion_label:"110 g por persona"};
    if(p.id==="estofado-res")return{...p,portion_type:"per_person",portion_value:200,portion_unit:"gramo",portion_label:"200 g por persona"};
    if(p.id==="fritada")return{...p,portion_type:"per_person",portion_value:220,portion_unit:"gramo",portion_label:"220 g por persona"};
    if(p.id==="hueso-carnudo")return{...p,portion_type:"per_person",portion_value:100,portion_unit:"gramo",portion_label:"100 g por persona"};
    if(p.id==="lomo-cerdo")return{...p,portion_type:"per_person",portion_value:200,portion_unit:"gramo",portion_label:"200 g por persona"};
    if(p.id==="pata-res")return{...p,portion_type:"per_person",portion_value:110,portion_unit:"gramo",portion_label:"110 g por persona"};
    if(p.id==="tilapia")return{...p,target_frequency:1};
    if(p.id==="camaron")return{...p,target_frequency:1};
    if(p.id==="hamburguesa-camaron")return{...p,target_frequency:0,active:false};
    return{...p};
  });
}

/** El segundo campamento demo representa el segundo día de recepción activo en producción. */
export function currentCampOverrides(camps:Camp[]):Camp[]{
  return camps.map((c,index)=>index===1?{...c,reception_weekday_default:2}:{...c});
}
