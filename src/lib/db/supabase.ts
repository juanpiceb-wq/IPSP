import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Camp, Catalog, Zone, MasterIngredient, MenuItem, MenuStatus, Protein, Recipe, RestrictiveProduct, Service, WeeklyMenu } from "../types";
import type { MenuFilters, Repo } from "./repo";

export class SupabaseRepo implements Repo {
  readonly mode="supabase" as const;
  private db:SupabaseClient;
  constructor(url:string,key:string){this.db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}

  async getCatalog():Promise<Catalog>{
    const [proteins,products,recipes,services,restr,camps,zones,ingredients]=await Promise.all([
      this.db.from("proteins").select("*").order("name"),
      this.db.from("restrictive_products").select("*").order("name"),
      this.db.from("recipes").select("*").order("name"),
      this.db.from("recipe_services").select("*"),
      this.db.from("recipe_restrictive_products").select("*"),
      this.db.from("camps").select("*").order("name"),
      this.db.from("zones").select("*").order("name"),
      this.db.from("ingredients").select("*").order("group").order("name"),
    ]);
    throwIf(proteins.error??products.error??recipes.error??services.error??restr.error??camps.error??zones.error??ingredients.error);
    const servicesByRecipe=new Map<string,Service[]>();
    for(const row of services.data??[]){const arr=servicesByRecipe.get(row.recipe_id)??[];arr.push(row.service as Service);servicesByRecipe.set(row.recipe_id,arr);}
    const restrByRecipe=new Map<string,string[]>();
    for(const row of restr.data??[]){const arr=restrByRecipe.get(row.recipe_id)??[];arr.push(row.restrictive_product_id);restrByRecipe.set(row.recipe_id,arr);}
    return{
      proteins:(proteins.data??[]) as Protein[],products:(products.data??[]) as RestrictiveProduct[],camps:(camps.data??[]) as Camp[],zones:(zones.data??[]) as Zone[],ingredients:(ingredients.data??[]) as MasterIngredient[],
      recipes:(recipes.data??[]).map(r=>({id:r.id,name:r.name,primary_protein_id:r.primary_protein_id,active:r.active,source:r.source,notes:r.notes,main_ingredients:Array.isArray(r.main_ingredients)?r.main_ingredients.map(String):[],salad_policy:r.salad_policy??null,services:servicesByRecipe.get(r.id)??[],restrictive_product_ids:restrByRecipe.get(r.id)??[],base_ingredient:r.base_ingredient??null,difficulty:(r.difficulty??1) as Recipe["difficulty"],cooking_method:r.cooking_method??null,double_fry:Boolean(r.double_fry),sunday_roast:Boolean(r.sunday_roast),base_qty_per_person:r.base_qty_per_person==null?null:Number(r.base_qty_per_person),base_unit:r.base_unit??null,protein_qty_per_person:r.protein_qty_per_person==null?null:Number(r.protein_qty_per_person),protein_unit:r.protein_unit??null,rice_mode:(r.rice_mode??"default") as Recipe["rice_mode"],fixed_weekday:r.fixed_weekday==null?null:Number(r.fixed_weekday) as Recipe["fixed_weekday"],fixed_service:(r.fixed_service??null) as Recipe["fixed_service"],only_weekday:r.only_weekday==null?null:Number(r.only_weekday) as Recipe["only_weekday"]})),
    };
  }

  async listMenus(filters:MenuFilters={}):Promise<WeeklyMenu[]>{
    let q=this.db.from("weekly_menus").select("*").order("year",{ascending:false}).order("week_number",{ascending:false});
    if(filters.campId)q=q.eq("camp_id",filters.campId);if(filters.year)q=q.eq("year",filters.year);if(filters.status)q=q.eq("status",filters.status);if(filters.limit)q=q.limit(filters.limit);
    const {data,error}=await q;throwIf(error);const ids=(data??[]).map(m=>m.id);if(!ids.length)return[];
    const {data:items,error:e2}=await this.db.from("menu_items").select("*").in("weekly_menu_id",ids);throwIf(e2);
    const byMenu=new Map<string,MenuItem[]>();for(const row of items??[]){const arr=byMenu.get(row.weekly_menu_id)??[];arr.push(rowToItem(row));byMenu.set(row.weekly_menu_id,arr);}
    return(data??[]).map(m=>({...m as WeeklyMenu,items:byMenu.get(m.id)??[]}));
  }

  async getMenu(id:string):Promise<WeeklyMenu|null>{const {data,error}=await this.db.from("weekly_menus").select("*").eq("id",id).maybeSingle();throwIf(error);if(!data)return null;const {data:items,error:e2}=await this.db.from("menu_items").select("*").eq("weekly_menu_id",id);throwIf(e2);return{...data as WeeklyMenu,items:(items??[]).map(rowToItem)};}

  async saveMenu(menu:WeeklyMenu):Promise<string>{
    const {items,...head}=menu;
    const rows=items.map(it=>({weekday:it.weekday,service:it.service,component:it.component,recipe_id:it.recipe_id,protein_id:it.protein_id,salad_recipe_id:it.salad_recipe_id,beverage:it.beverage,locked:it.locked,reasons:it.reasons,execution_status:it.execution_status??"pending",replacement_name:it.replacement_name??null,salad_execution_status:it.salad_execution_status??"pending",beverage_execution_status:it.beverage_execution_status??"pending"}));
    const {error}=await this.db.rpc("save_weekly_menu_atomic",{p_head:head,p_items:rows});throwIf(error);return menu.id;
  }

  async setMenuStatus(id:string,status:MenuStatus){const {error}=await this.db.from("weekly_menus").update({status}).eq("id",id);throwIf(error);}
  async deleteMenu(id:string){const {error}=await this.db.from("weekly_menus").delete().eq("id",id);throwIf(error);}

  async upsertRecipe(recipe:Recipe){
    const {services,restrictive_product_ids,...head}=recipe;const {error}=await this.db.from("recipes").upsert(head);throwIf(error);
    const {error:d1}=await this.db.from("recipe_services").delete().eq("recipe_id",recipe.id);throwIf(d1);
    if(services.length){const {error:e2}=await this.db.from("recipe_services").insert(services.map(service=>({recipe_id:recipe.id,service})));throwIf(e2);}
    const {error:d2}=await this.db.from("recipe_restrictive_products").delete().eq("recipe_id",recipe.id);throwIf(d2);
    if(restrictive_product_ids.length){const {error:e3}=await this.db.from("recipe_restrictive_products").insert(restrictive_product_ids.map(restrictive_product_id=>({recipe_id:recipe.id,restrictive_product_id})));throwIf(e3);}
  }
  async upsertProtein(protein:Protein){const {error}=await this.db.from("proteins").upsert(protein);throwIf(error);}
  async upsertProduct(product:RestrictiveProduct){const {error}=await this.db.from("restrictive_products").upsert(product);throwIf(error);}
  async upsertCamp(camp:Camp){const {error}=await this.db.from("camps").upsert(camp);throwIf(error);}
  async deleteCamp(id:string){const {error}=await this.db.from("camps").delete().eq("id",id);throwIf(error);}
  async upsertZone(zone:Zone){const {error}=await this.db.from("zones").upsert(zone);throwIf(error);}
  async deleteZone(id:string){const {error:e1}=await this.db.from("camps").update({zone_id:null}).eq("zone_id",id);throwIf(e1);const {error}=await this.db.from("zones").delete().eq("id",id);throwIf(error);}
}

function rowToItem(row:Record<string,unknown>):MenuItem{return{weekday:row.weekday as MenuItem["weekday"],service:row.service as MenuItem["service"],component:row.component as MenuItem["component"],recipe_id:(row.recipe_id as string)??null,protein_id:(row.protein_id as string)??null,salad_recipe_id:(row.salad_recipe_id as string)??null,beverage:(row.beverage as string)??null,locked:Boolean(row.locked),reasons:(row.reasons as string[])??[],execution_status:(row.execution_status as MenuItem["execution_status"])??"pending",replacement_name:(row.replacement_name as string)??null,salad_execution_status:(row.salad_execution_status as MenuItem["salad_execution_status"])??"pending",beverage_execution_status:(row.beverage_execution_status as MenuItem["beverage_execution_status"])??"pending"};}
function throwIf(error:{message:string}|null|undefined){if(error)throw new Error(error.message);}
