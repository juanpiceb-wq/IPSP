-- IPSP · Megazonas del organigrama de producción (ANX-TH-PR1-001 v41.0)
-- Megazona → Zona → Campamento (sector). Cambio aditivo: no modifica datos existentes.

create table if not exists public.megazones (
  id         text primary key,
  name       text not null,
  color      text,
  manager    text,
  notes      text,
  sort_order integer not null default 0,
  active     boolean not null default true
);

alter table public.zones add column if not exists megazone_id text references public.megazones(id) on delete set null;
create index if not exists idx_zones_megazone on public.zones(megazone_id);

-- Mismo criterio que el resto de tablas de negocio: solo el servidor (service role) lee y escribe.
alter table public.megazones enable row level security;
drop policy if exists beta_all on public.megazones;
revoke all on table public.megazones from anon, authenticated;
