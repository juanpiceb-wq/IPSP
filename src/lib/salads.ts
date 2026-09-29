import type { Catalog, MenuItem, Recipe, Weekday } from "./types";
import { cyclePosition } from "./rules";

export const SALAD_STOCK_ID = "ensalada-segun-stock";
type SaladSpec = { id: string; name: string; ingredients: string[]; restrictive?: string[] };

const SPECS: SaladSpec[] = [
  { id: "encurtido-de-cebolla-colorada", name: "Encurtido de cebolla colorada", ingredients: ["cebolla-colorada"] },
  { id: "ensalada-de-col-y-zanahoria", name: "Ensalada de col y zanahoria", ingredients: ["col","zanahoria"] },
  { id: "ensalada-de-remolacha-con-zanahoria-y-papa", name: "Ensalada de remolacha con zanahoria y papa", ingredients: ["remolacha","zanahoria","papa"], restrictive: ["remolacha"] },
  { id: "ensalada-de-remolacha-con-mayonesa", name: "Ensalada de remolacha con mayonesa", ingredients: ["remolacha","mayonesa"], restrictive: ["remolacha"] },
  { id: "ensalada-de-pepino-y-cebolla-colorada", name: "Ensalada de pepino y cebolla colorada", ingredients: ["pepino","cebolla-colorada"], restrictive: ["pepino"] },
  { id: "ensalada-de-pepino-cebolla-colorada-tomate-y-rabano", name: "Ensalada de pepino, cebolla colorada, tomate y rábano", ingredients: ["pepino","cebolla-colorada","tomate","rabano"], restrictive: ["pepino","rabano"] },
  { id: "ensalada-de-cebolla-colorada-tomate-limon-y-cilantro", name: "Ensalada de cebolla colorada, tomate, limón y cilantro", ingredients: ["cebolla-colorada","tomate","limon","cilantro"] },
  { id: "ensalada-de-col-zanahoria-y-tomate", name: "Ensalada de col, zanahoria y tomate", ingredients: ["col","zanahoria","tomate"] },
  { id: "ensalada-de-brocoli-choclo-y-papa", name: "Ensalada de brócoli, choclo y papa", ingredients: ["brocoli","choclo","papa"], restrictive: ["brocoli"] },
  { id: "ensalada-de-choclo-tomate-y-cebolla-colorada", name: "Ensalada de choclo, tomate y cebolla colorada", ingredients: ["choclo","tomate","cebolla-colorada"] },
  { id: "ensalada-rusa-de-papa-zanahoria-y-choclo", name: "Ensalada rusa de papa, zanahoria y choclo", ingredients: ["papa","zanahoria","choclo"] },
  { id: "ensalada-de-verdura-con-papa", name: "Ensalada de verdura con papa", ingredients: ["verdura","papa"], restrictive: ["verdura"] },
  { id: "ensalada-de-verdura-con-tomate-y-cebolla-colorada", name: "Ensalada de verdura con tomate y cebolla colorada", ingredients: ["verdura","tomate","cebolla-colorada"], restrictive: ["verdura"] },
  { id: "ensalada-de-frejol-cebolla-colorada-papa-y-tomate", name: "Ensalada de fréjol, cebolla colorada, papa y tomate", ingredients: ["frejol","cebolla-colorada","papa","tomate"] },
  { id: "ensalada-de-rabano-cebolla-colorada-y-tomate", name: "Ensalada de rábano, cebolla colorada y tomate", ingredients: ["rabano","cebolla-colorada","tomate"], restrictive: ["rabano"] },
];

export const SALAD_INGREDIENT_LIMITS: Record<string, { label: string; max: number }> = {
  tomate:{label:"Tomate",max:4},"cebolla-colorada":{label:"Cebolla colorada",max:4},
  zanahoria:{label:"Zanahoria",max:4},papa:{label:"Papa",max:4},choclo:{label:"Choclo",max:4},
  col:{label:"Col",max:4},pepino:{label:"Pepino",max:2},remolacha:{label:"Remolacha",max:2},
  verdura:{label:"Verdura",max:2},brocoli:{label:"Brócoli",max:1},rabano:{label:"Rábano",max:1},
};

export const FINAL_SALAD_RECIPES: Recipe[] = [
  ...SPECS.map((s)=>({
    id:s.id,name:s.name,primary_protein_id:null,services:["salad"] as Recipe["services"],
    restrictive_product_ids:s.restrictive??[],active:true,source:"MAESTRO_IPSP_REVISADO_2026-09-29.xlsx · ensaladas",
    notes:`Ingredientes principales: ${s.ingredients.join(", ")}.`,main_ingredients:s.ingredients,salad_policy:null,
    base_ingredient:null,difficulty:1 as const,cooking_method:"Ensalada",double_fry:false,sunday_roast:false,
    base_qty_per_person:null,base_unit:null,protein_qty_per_person:null,protein_unit:null,rice_mode:"default" as const,
    fixed_weekday:null,fixed_service:null,only_weekday:null,
  })),
  {id:SALAD_STOCK_ID,name:"Ensalada según stock",primary_protein_id:null,services:["salad"],restrictive_product_ids:[],
   active:true,source:"Regla operativa IPSP · marcador stock",notes:"Solo días 6 y 7 del ciclo; una por día.",
   main_ingredients:[],salad_policy:null,base_ingredient:null,difficulty:1,cooking_method:"Ensalada",double_fry:false,
   sunday_roast:false,base_qty_per_person:null,base_unit:null,protein_qty_per_person:null,protein_unit:null,
   rice_mode:"default",fixed_weekday:null,fixed_service:null,only_weekday:null}
];
const INGREDIENTS_BY_RECIPE=new Map(SPECS.map((s)=>[s.id,s.ingredients]));
export function saladIngredientKeys(recipeId:string|null|undefined){if(!recipeId||recipeId===SALAD_STOCK_ID)return [];return INGREDIENTS_BY_RECIPE.get(recipeId)??[];}
function saladUsage(items:MenuItem[]){const usage=new Map<string,number>();for(const item of items)for(const key of saladIngredientKeys(item.salad_recipe_id))usage.set(key,(usage.get(key)??0)+1);return usage;}
export function saladIngredientCapReason(items:MenuItem[],candidateId:string){const usage=saladUsage(items);for(const key of saladIngredientKeys(candidateId)){const limit=SALAD_INGREDIENT_LIMITS[key];if(limit&&(usage.get(key)??0)>=limit.max)return `${limit.label} ya aparece en ${usage.get(key)??0} ensalada(s); máximo semanal ${limit.max}.`;}return null;}
export function saladIngredientViolations(items:MenuItem[]){const usage=saladUsage(items);return [...usage.entries()].map(([key,used])=>({key,used,limit:SALAD_INGREDIENT_LIMITS[key]})).filter((x)=>!!x.limit&&x.used>x.limit.max).map((x)=>({key:x.key,label:x.limit.label,used:x.used,max:x.limit.max}));}
export function saladTimingReason(recipeId:string,weekday:Weekday,arrival:Weekday){const pos=cyclePosition(weekday,arrival);if(pos>=6&&recipeId!==SALAD_STOCK_ID)return "En los días 6 y 7 del ciclo solo corresponde Ensalada según stock.";if(pos<=5&&recipeId===SALAD_STOCK_ID)return "Ensalada según stock se reserva únicamente para los días 6 y 7 del ciclo.";return null;}
function norm(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().trim();}
export function mainAllowsSalad(main:Recipe){if(norm(main.name).includes("CEVICHE"))return false;const p=norm(main.salad_policy??"SI");return p!=="NO"&&p!=="NO APLICA";}
export function saladAllowedForMain(main:Recipe,salad:Recipe){if(!mainAllowsSalad(main))return false;if(salad.id===SALAD_STOCK_ID)return true;const p=norm(main.salad_policy??"SI");const ingredients=new Set(saladIngredientKeys(salad.id));if(p==="SI"||!p)return true;if(p.includes("CUALQUIERA CON COL"))return ingredients.has("col");if(p.includes("SOLO ENCURTIDO"))return salad.id==="encurtido-de-cebolla-colorada";if(p.includes("TOMATE")&&p.includes("CEBOLLA COLORADA"))return ingredients.has("tomate")&&ingredients.has("cebolla-colorada");if(p.includes("CON CEBOLLA COLORADA")||p.includes("DE CEBOLLA COLORADA"))return ingredients.has("cebolla-colorada");return true;}
export function saladPreferenceScore(salad:Recipe){return saladIngredientKeys(salad.id).includes("col")?90:0;}
export function isFinalSalad(recipeId:string|null|undefined){return !!recipeId&&(recipeId===SALAD_STOCK_ID||INGREDIENTS_BY_RECIPE.has(recipeId));}
export function finalSaladCatalog(catalog:Catalog){return catalog.recipes.filter((r)=>r.active&&r.services.includes("salad")&&isFinalSalad(r.id));}
