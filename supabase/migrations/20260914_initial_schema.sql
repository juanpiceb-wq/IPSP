-- =====================================================================
--  Planificación de Alimentación · esquema Supabase / PostgreSQL
--  Ejecutar completo en el SQL Editor de Supabase antes que seed.sql
-- =====================================================================


create table if not exists zones (
  id text primary key,
  name text not null,
  notes text,
  active boolean not null default true
);

create table if not exists camps (
  id                        text primary key,
  name                      text not null,
  diners_default            integer not null default 100,
  reception_weekday_default smallint not null default 1, -- 0=Lunes … 6=Domingo
  delivery_notes            text,
  notes                     text,
  zone_id                   text references zones(id) on delete set null,
  active                    boolean not null default true
);

create table if not exists proteins (
  id               text primary key,
  name             text not null,
  origin           text not null,                 -- cerdo | res | pollo | pescado | marisco | huevo | otro
  breakfast_only   boolean not null default false,
  soup_only        boolean not null default false,
  parity           text not null default 'todas', -- todas | par | impar
  target_frequency integer not null default 0,
  portion_type     text not null default 'none',  -- per_person | per_group | none
  portion_value    numeric,
  portion_unit     text,
  portion_label    text not null default '',
  active           boolean not null default true,
  notes            text
);

create table if not exists restrictive_products (
  id             text primary key,
  name           text not null,
  parity         text not null default 'todas',   -- todas | par | impar
  category       text not null default 'Otro',
  arrival_weekday smallint,                       -- null = llega con el despacho principal
  active         boolean not null default true,
  notes          text
);

-- Sobrescritura del día de llegada de un producto para un campamento concreto
create table if not exists camp_product_availability (
  camp_id         text not null references camps(id) on delete cascade,
  product_id      text not null references restrictive_products(id) on delete cascade,
  arrival_weekday smallint,
  primary key (camp_id, product_id)
);

-- Lista maestra de ingredientes (referencia y validación)
create table if not exists ingredients (
  id           text primary key,
  name         text not null,
  "group"      text not null default 'Otro',
  restrictive  boolean not null default false,
  availability text not null default 'todas', -- todas | par | impar
  use_in_menu  boolean not null default true,
  note         text
);

create table if not exists recipes (
  id                 text primary key,
  name               text not null,
  primary_protein_id text references proteins(id),
  active             boolean not null default true,
  source             text not null default 'Catálogo inicial',
  notes              text,
  base_ingredient    text,
  difficulty         smallint not null default 1 check (difficulty between 1 and 3),
  cooking_method     text,
  double_fry         boolean not null default false,
  sunday_roast       boolean not null default false,
  base_qty_per_person numeric,
  base_unit          text,
  protein_qty_per_person numeric,
  protein_unit       text,
  rice_mode          text not null default 'default',
  fixed_weekday      smallint,
  fixed_service      text,
  only_weekday       smallint
);

create table if not exists recipe_services (
  recipe_id text not null references recipes(id) on delete cascade,
  service   text not null, -- breakfast | lunch | dinner | soup | salad
  primary key (recipe_id, service)
);

create table if not exists recipe_restrictive_products (
  recipe_id             text not null references recipes(id) on delete cascade,
  restrictive_product_id text not null references restrictive_products(id) on delete cascade,
  primary key (recipe_id, restrictive_product_id)
);

create table if not exists weekly_menus (
  id                     text primary key,
  year                   integer not null,
  week_number            integer not null,
  parity                 text not null,          -- par | impar
  camp_id                text not null references camps(id),
  diners                 integer not null,
  supply_arrival_weekday smallint not null,
  actual_start_date      date,
  actual_end_date        date,
  status                 text not null default 'borrador', -- borrador | aprobado | utilizado
  validation_score       integer not null default 0,
  variety_score          integer not null default 0,
  seed                   text,
  notes                  text,
  created_at             timestamptz not null default now()
);

create table if not exists menu_items (
  id              bigserial primary key,
  weekly_menu_id  text not null references weekly_menus(id) on delete cascade,
  weekday         smallint not null,             -- 0=Lunes … 6=Domingo
  service         text not null,                 -- breakfast | lunch | dinner
  component       text not null,                 -- main | soup
  recipe_id       text references recipes(id),
  protein_id      text references proteins(id),
  salad_recipe_id text references recipes(id),
  beverage        text,
  locked          boolean not null default false,
  reasons         jsonb not null default '[]'::jsonb,
  execution_status text not null default 'pending', -- pending | as_planned | replaced
  replacement_name text,
  salad_execution_status text not null default 'pending',
  beverage_execution_status text not null default 'pending'
);

create index if not exists idx_menu_items_menu on menu_items(weekly_menu_id);
create index if not exists idx_weekly_menus_week on weekly_menus(year, week_number);
create index if not exists idx_recipes_protein on recipes(primary_protein_id);

-- ---------------------------------------------------------------------
--  RLS abierta para la beta (herramienta interna sin autenticación).
--  Para producción: restringir por rol autenticado.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'zones','camps','proteins','restrictive_products','camp_product_availability','ingredients',
    'recipes','recipe_services','recipe_restrictive_products','weekly_menus','menu_items'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists beta_all on %I', t);
    execute format(
      'create policy beta_all on %I for all to anon, authenticated using (true) with check (true)', t
    );
  end loop;
end $$;
