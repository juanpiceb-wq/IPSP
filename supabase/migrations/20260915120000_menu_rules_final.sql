-- IPSP · reglas finales del generador · 2026-09-15
-- Ejecutar DESPUÉS de 20260915_menu_intelligence.sql.
-- No elimina históricos ni menús existentes.

-- Máximos/objetivos semanales vigentes. Son topes, no cuotas obligatorias.
update proteins set target_frequency=3 where id='fritada';
update proteins set target_frequency=1 where id='hamburguesa-res';
update proteins set target_frequency=2 where id='pollo';
update proteins set target_frequency=2 where id='chorizo';
update proteins set target_frequency=2 where id='chuleta-cerdo';
update proteins set target_frequency=1 where id='lomo-cerdo';
update proteins set target_frequency=1 where id='estofado-res';
update proteins set target_frequency=2 where id='carne-molida';
update proteins set target_frequency=2 where id='cuero-cerdo';
update proteins set target_frequency=2 where id='atun';
update proteins set target_frequency=2 where id='sardina';
update proteins set target_frequency=1 where id='hamburguesa-camaron';
update proteins set target_frequency=2 where id='camaron';
update proteins set target_frequency=2 where id='tilapia';
update proteins set target_frequency=2 where id='huevo';

update proteins set breakfast_only=true where id in ('atun','huevo');
update proteins set breakfast_only=false,
  notes='Solo almuerzo, excepto Corviche de sardina que también puede ir en desayuno. Semana impar. Máximo 2 sujeto a stock efectivo.'
where id='sardina';

-- Atún y Huevo son exclusivos de desayuno.
delete from recipe_services rs using recipes r
where rs.recipe_id=r.id and r.primary_protein_id in ('atun','huevo') and rs.service <> 'breakfast';
insert into recipe_services(recipe_id,service)
select id,'breakfast' from recipes where primary_protein_id in ('atun','huevo') and active=true
on conflict do nothing;

-- Sardina: almuerzo, excepto el Corviche de sardina que también puede ir en desayuno.
delete from recipe_services rs using recipes r
where rs.recipe_id=r.id and r.primary_protein_id='sardina';
insert into recipe_services(recipe_id,service)
select id,'lunch' from recipes where primary_protein_id='sardina' and active=true
on conflict do nothing;
insert into recipe_services(recipe_id,service)
values ('corviche-de-sardina','breakfast')
on conflict do nothing;

-- Las demás proteínas generales pueden participar en desayuno. Se respetan exclusiones
-- explícitas: sopa, doble fritura, platos fijos/solo-día.
insert into recipe_services(recipe_id,service)
select distinct r.id,'breakfast'
from recipes r
where r.active=true
  and r.primary_protein_id is not null
  and r.primary_protein_id not in ('atun','huevo','sardina','hueso-carnudo','costilla-res','pata-res')
  and coalesce(r.double_fry,false)=false
  and r.fixed_service is null
  and r.only_weekday is null
  and exists (
    select 1 from recipe_services rs
    where rs.recipe_id=r.id and rs.service in ('lunch','dinner')
  )
on conflict do nothing;

-- Doble fritura queda exclusivamente en cena.
delete from recipe_services rs using recipes r
where rs.recipe_id=r.id and coalesce(r.double_fry,false)=true and rs.service <> 'dinner';
insert into recipe_services(recipe_id,service)
select id,'dinner' from recipes where active=true and coalesce(double_fry,false)=true
on conflict do nothing;

-- Asegura el almuerzo dominical fijo y las banderas de asado conocidas.
update recipes set fixed_weekday=6, fixed_service='lunch', only_weekday=null
where id='ceviche-de-pescado-con-chifle';
update recipes set sunday_roast=true where id in (
  'pollo-asado-con-papas-y-salsa-de-queso',
  'lomo-de-cerdo-asado',
  'chuleta-asada-con-papa-y-salsa-de-queso',
  'menestra-de-frejol-con-chuleta-asada',
  'cuero-asado-con-menestra-de-frejol'
);


-- Preparación operativa faltante en el maestro de platos: hamburguesa de camarón.
insert into recipes (
  id,name,primary_protein_id,active,source,notes,base_ingredient,difficulty,cooking_method,
  double_fry,sunday_roast,protein_qty_per_person,protein_unit,rice_mode
) values (
  'hamburguesa-de-camaron','Hamburguesa de camarón','hamburguesa-camaron',true,'Regla operativa IPSP',
  '1 hamburguesa de camarón por persona. Máximo semanal 1.','Sin base dominante',1,'Plancha',false,false,1,'UN','default'
) on conflict (id) do update set
  name=excluded.name, primary_protein_id=excluded.primary_protein_id, active=excluded.active,
  source=excluded.source, notes=excluded.notes, base_ingredient=excluded.base_ingredient,
  difficulty=excluded.difficulty, cooking_method=excluded.cooking_method, double_fry=excluded.double_fry,
  sunday_roast=excluded.sunday_roast, protein_qty_per_person=excluded.protein_qty_per_person,
  protein_unit=excluded.protein_unit, rice_mode=excluded.rice_mode;
insert into recipe_services(recipe_id,service) values
  ('hamburguesa-de-camaron','breakfast'),
  ('hamburguesa-de-camaron','lunch'),
  ('hamburguesa-de-camaron','dinner')
on conflict do nothing;
