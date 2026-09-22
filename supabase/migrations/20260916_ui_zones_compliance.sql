-- IPSP · Zonas + cumplimiento por componente + soporte UI operacional
-- Ejecutar después de las migraciones 20260915_*.

create table if not exists zones (
  id text primary key,
  name text not null,
  notes text,
  active boolean not null default true
);

alter table camps add column if not exists zone_id text references zones(id) on delete set null;

alter table menu_items add column if not exists salad_execution_status text not null default 'pending';
alter table menu_items add column if not exists beverage_execution_status text not null default 'pending';

create index if not exists idx_camps_zone on camps(zone_id);

do $$
begin
  alter table zones enable row level security;
exception when others then null;
end $$;

drop policy if exists beta_all on zones;
create policy beta_all on zones for all to anon, authenticated using (true) with check (true);
