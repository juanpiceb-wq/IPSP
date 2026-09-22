/**
 * Genera supabase/seed.sql a partir del seed TypeScript.
 * Uso: npm run gen:sql
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { CAMPS, MASTER_INGREDIENTS, PRODUCTS, PROTEINS, RECIPES, historicalMenus } from "../src/lib/seed/data";

function q(v: string | null | undefined): string {
  if (v === null || v === undefined) return "null";
  return `'${v.replace(/'/g, "''")}'`;
}
function n(v: number | null | undefined): string {
  return v === null || v === undefined ? "null" : String(v);
}
function b(v: boolean): string {
  return v ? "true" : "false";
}

const out: string[] = [];
out.push("-- =====================================================================");
out.push("--  Seed inicial · generado automáticamente (npm run gen:sql)");
out.push("--  Ejecutar DESPUÉS de schema.sql");
out.push("-- =====================================================================");
out.push("");

out.push("-- Campamentos");
for (const c of CAMPS) {
  out.push(
    `insert into camps (id,name,diners_default,reception_weekday_default,notes,active) values (${q(c.id)},${q(
      c.name
    )},${n(c.diners_default)},${n(c.reception_weekday_default)},${q(c.notes ?? null)},${b(
      c.active
    )}) on conflict (id) do nothing;`
  );
}

out.push("", "-- Proteínas");
for (const p of PROTEINS) {
  out.push(
    `insert into proteins (id,name,origin,breakfast_only,soup_only,parity,target_frequency,portion_type,portion_value,portion_unit,portion_label,active,notes) values (${q(
      p.id
    )},${q(p.name)},${q(p.origin)},${b(p.breakfast_only)},${b(p.soup_only)},${q(p.parity)},${n(
      p.target_frequency
    )},${q(p.portion_type)},${n(p.portion_value)},${q(p.portion_unit)},${q(p.portion_label)},${b(
      p.active
    )},${q(p.notes ?? null)}) on conflict (id) do nothing;`
  );
}

out.push("", "-- Productos restrictivos");
for (const p of PRODUCTS) {
  out.push(
    `insert into restrictive_products (id,name,parity,category,arrival_weekday,active,notes) values (${q(
      p.id
    )},${q(p.name)},${q(p.parity)},${q(p.category)},${n(p.arrival_weekday)},${b(p.active)},${q(
      p.notes ?? null
    )}) on conflict (id) do nothing;`
  );
}

out.push("", "-- Lista maestra de ingredientes");
for (const i of MASTER_INGREDIENTS) {
  out.push(
    `insert into ingredients (id,name,"group",restrictive,availability,use_in_menu,note) values (${q(i.id)},${q(
      i.name
    )},${q(i.group)},${b(i.restrictive)},${q(i.availability)},${b(i.use_in_menu)},${q(
      i.note
    )}) on conflict (id) do nothing;`
  );
}

out.push("", "-- Preparaciones");
for (const r of RECIPES) {
  out.push(
    `insert into recipes (id,name,primary_protein_id,active,source,notes) values (${q(r.id)},${q(
      r.name
    )},${q(r.primary_protein_id)},${b(r.active)},${q(r.source)},${q(
      r.notes ?? null
    )}) on conflict (id) do nothing;`
  );
}

out.push("", "-- Servicios por preparación");
for (const r of RECIPES) {
  for (const s of r.services) {
    out.push(
      `insert into recipe_services (recipe_id,service) values (${q(r.id)},${q(
        s
      )}) on conflict do nothing;`
    );
  }
}

out.push("", "-- Productos restrictivos por preparación");
for (const r of RECIPES) {
  for (const p of r.restrictive_product_ids) {
    out.push(
      `insert into recipe_restrictive_products (recipe_id,restrictive_product_id) values (${q(
        r.id
      )},${q(p)}) on conflict do nothing;`
    );
  }
}

out.push("", "-- Menús históricos (semanas 37, 38 y 39)");
for (const m of historicalMenus()) {
  out.push(
    `insert into weekly_menus (id,year,week_number,parity,camp_id,diners,supply_arrival_weekday,actual_start_date,actual_end_date,status,validation_score,variety_score,seed,notes,created_at) values (${q(
      m.id
    )},${n(m.year)},${n(m.week_number)},${q(m.parity)},${q(m.camp_id)},${n(m.diners)},${n(
      m.supply_arrival_weekday
    )},${q(m.actual_start_date)},${q(m.actual_end_date)},${q(m.status)},${n(
      m.validation_score
    )},${n(m.variety_score)},${q(m.seed)},${q(m.notes)},${q(m.created_at)}) on conflict (id) do nothing;`
  );
  for (const it of m.items) {
    out.push(
      `insert into menu_items (weekly_menu_id,weekday,service,component,recipe_id,protein_id,salad_recipe_id,beverage,locked,reasons) values (${q(
        m.id
      )},${n(it.weekday)},${q(it.service)},${q(it.component)},${q(it.recipe_id)},${q(
        it.protein_id
      )},${q(it.salad_recipe_id)},${q(it.beverage)},${b(it.locked)},'[]'::jsonb);`
    );
  }
}

mkdirSync("supabase", { recursive: true });
writeFileSync("supabase/seed.sql", out.join("\n") + "\n", "utf8");
console.log(
  `seed.sql generado · ${PROTEINS.length} proteínas · ${PRODUCTS.length} productos · ${MASTER_INGREDIENTS.length} ingredientes · ${RECIPES.length} preparaciones · ${historicalMenus().length} menús históricos`
);
