import type { Protein } from "../types";

/**
 * El seed histórico se conserva para trazabilidad, pero el modo demo/pruebas debe usar
 * las mismas cuotas operativas que producción. Las recetas reales viven en Supabase.
 */
export function currentProteinOverrides(proteins:Protein[]):Protein[]{
  return proteins.map(p=>{
    if(p.id==="chorizo")return{...p,target_frequency:1};
    if(p.id==="tilapia")return{...p,target_frequency:1};
    if(p.id==="camaron")return{...p,target_frequency:1};
    if(p.id==="hamburguesa-camaron")return{...p,target_frequency:0,active:false};
    return{...p};
  });
}
