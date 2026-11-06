-- IPSP · Carga del organigrama de zonas ANX-TH-PR1-001 v41.0 (26/10/2026)
-- Megazonas → zonas → campamentos resaltados que faltaban. Idempotente.
-- Campamentos nuevos: inactivos, 100 comensales, recepción por confirmar (queda martes como valor provisional).
begin;

insert into public.megazones (id,name,color,manager,notes,sort_order,active) values
  ('peninsula-dfip','Península','#b4c6e7','Ing. Rolando Quevedo',null,1,true),
  ('sunauplio-auzr','Sunauplio','#ffffff',null,'Sin zonas en el organigrama v41.0.',2,true),
  ('sularva-abhn','Sularva','#ffffff',null,'Sin zonas en el organigrama v41.0.',3,true),
  ('oceania-rikt','Oceanía','#ddb8a4','Ing. Edgar Alburqueque',null,4,true),
  ('media-ivap','Media','#e8dd4f','Ing. Jorge Rueda','Gerente zonal: excepto zona Bajen A – Bajen B – Daular (organigrama ANX-TH-PR1-001 v41.0).',5,true),
  ('tpi-6ae6','TPI','#d9d9d9',null,'Sin zonas en el organigrama v41.0.',6,true),
  ('golfo-47om','Golfo','#d9d9d9',null,'El organigrama v41.0 no indica Gerente Zonal para esta megazona.',7,true),
  ('taura-ex08','Taura','#a9c98b','Ing. Manuel Agurto · Ing. Hedilbert Yacila','Ing. Manuel Agurto: excepto zona Taura B – Taura C – Taura E – Tilapia. Ing. Hedilbert Yacila: excepto zona Taura A – Taura D – Taura E – Tilapia.',8,true),
  ('california-1ek0','California','#b7d7f0','Ing. Reguis Sunción','Gerente zonal: excepto zona Churute.',9,true)
on conflict (id) do nothing;

-- Zonas existentes: Bajen pasa a ser Bajen A; Playas, Daular y Corvinero C se asignan a su megazona.
update public.zones set megazone_id='oceania-rikt' where id='playas-vk7i';
update public.zones set megazone_id='media-ivap', name='Bajen A' where id='bajen-4hox';
update public.zones set megazone_id='media-ivap' where id='daular-feh2';
update public.zones set megazone_id='media-ivap' where id='corvinero-c-4xr2';

-- Zonas nuevas del organigrama
insert into public.zones (id,name,notes,megazone_id,active)
select v.id,v.name,null,v.megazone_id,true from (values
  ('chanduy-fslz','Chanduy','peninsula-dfip'),
  ('panamao-a-1n2o','Pañamao A','peninsula-dfip'),
  ('panamao-b-udnc','Pañamao B','peninsula-dfip'),
  ('korea-29di','Korea','oceania-rikt'),
  ('sabana-mx1g','Sabana','oceania-rikt'),
  ('bajen-b-4so8','Bajen B','media-ivap'),
  ('corvinero-a-bzcf','Corvinero A','media-ivap'),
  ('corvinero-b-x3bn','Corvinero B','media-ivap'),
  ('africa-e4nt','África','media-ivap'),
  ('asia-a46r','Asia','media-ivap'),
  ('golfo-wwws','Golfo','golfo-47om'),
  ('taura-a-8bz2','Taura A','taura-ex08'),
  ('taura-b-mg6q','Taura B','taura-ex08'),
  ('taura-c-s4w4','Taura C','taura-ex08'),
  ('taura-d-xb72','Taura D','taura-ex08'),
  ('taura-e-y7xg','Taura E','taura-ex08'),
  ('tilapia-xpxe','Tilapia','taura-ex08'),
  ('churute-cxs3','Churute','california-1ek0'),
  ('california-a-z394','California A','california-1ek0'),
  ('california-b-2z0j','California B','california-1ek0')
) as v(id,name,megazone_id)
where not exists (select 1 from public.zones z where lower(z.name)=lower(v.name));

-- Bajen B: Kansas, España, México I y México IV
update public.camps set zone_id='bajen-b-4so8' where id in ('kansas-lv40','espana-s0tz','mexico-1-cm66','mexico-4-wbp1');

-- Campamentos resaltados que faltaban (inactivos)
insert into public.camps (id,name,diners_default,reception_weekday_default,delivery_notes,notes,zone_id,active)
select v.id,v.name,100,1,null,v.notes,v.zone_id,false from (values
  ('psector-6-la-rita-pn19','PSector 6 (La Rita)','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: PSector VI (La Rita).','panamao-b-udnc'),
  ('el-salvador-u0ku','El Salvador','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: El Salvador.','korea-29di'),
  ('faro-1-7jxf','Faro 1','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Faro I.','korea-29di'),
  ('faro-2-qooa','Faro 2','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Faro II.','korea-29di'),
  ('panama-86uk','Panamá','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Panamá.','korea-29di'),
  ('singapur-hdbf','Singapur','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Singapur.','sabana-mx1g'),
  ('jamaica-xx3t','Jamaica','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Jamaica.','sabana-mx1g'),
  ('guatemala-siw2','Guatemala','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Guatemala.','corvinero-a-bzcf'),
  ('capulsa-44qd','Capulsa','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Capulsa.','corvinero-a-bzcf'),
  ('costa-rica-1-049i','Costa Rica 1','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Costa Rica I.','corvinero-a-bzcf'),
  ('emiratos-5r0u','Emiratos','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Emiratos.','corvinero-b-x3bn'),
  ('dakar-3nl0','Dakar','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Dakar.','corvinero-b-x3bn'),
  ('trinidad-3k8s','Trinidad','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Trinidad.','daular-feh2'),
  ('ruanda-9rx4','Ruanda','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Ruanda.','africa-e4nt'),
  ('marruecos-gvix','Marruecos','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Marruecos.','africa-e4nt'),
  ('camerun-dutx','Camerún','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Camerún.','africa-e4nt'),
  ('japon-ushs','Japón','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Japón.','asia-a46r'),
  ('china-7pjm','China','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: China.','asia-a46r'),
  ('suecia-2-f5xt','Suecia 2','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Suecia II.','golfo-wwws'),
  ('australia-jigs','Australia','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Australia.','golfo-wwws'),
  ('nueva-zelanda-easo','Nueva Zelanda','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Nueva Zelanda.','golfo-wwws'),
  ('bora-bora-2-2fxy','Bora Bora 2','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Bora Bora II.','golfo-wwws'),
  ('campoverde-vkid','Campoverde','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Campoverde.','golfo-wwws'),
  ('taura-3-q2gh','Taura 3','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Taura III.','taura-a-8bz2'),
  ('garita-o4k6','Garita','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Garita.','taura-a-8bz2'),
  ('taura-6-ppkw','Taura 6','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Taura VI.','taura-a-8bz2'),
  ('taura-4-3w21','Taura 4','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Taura IV.','taura-b-mg6q'),
  ('taura-5-p3ty','Taura 5','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Taura V.','taura-b-mg6q'),
  ('la-luz-oz8j','La Luz','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: La luz.','taura-c-s4w4'),
  ('taura-7-zzxj','Taura 7','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Taura VII.','taura-c-s4w4'),
  ('taura-1-m1r9','Taura 1','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Taura I.','taura-d-xb72'),
  ('portillo-xy6r','Portillo','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Portillo.','taura-d-xb72'),
  ('churute-53gv','Churute','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Churute.','churute-cxs3'),
  ('los-angeles-8xij','Los Ángeles','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Los Ángeles.','california-a-z394'),
  ('santa-monica-3bzt','Santa Mónica','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Santa Mónica.','california-b-2z0j'),
  ('santa-rosa-9am0','Santa Rosa','Pendiente: confirmar día de recepción de víveres y comensales antes de activar. Sector del organigrama: Santa Rosa.','california-b-2z0j')
) as v(id,name,notes,zone_id)
where not exists (select 1 from public.camps c where lower(c.name)=lower(v.name));

commit;
