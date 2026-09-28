alter table weekly_menus
  add column if not exists schedule_shift_days integer not null default 0;

comment on column weekly_menus.schedule_shift_days is
  'Desplazamiento en días aplicado al menú base compartido para adaptarlo al día de recepción del campamento.';
