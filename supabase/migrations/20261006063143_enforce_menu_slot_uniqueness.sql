create unique index if not exists weekly_menus_one_per_camp_week
on public.weekly_menus(camp_id, year, week_number);

create unique index if not exists menu_items_one_per_slot
on public.menu_items(weekly_menu_id, weekday, service, component);

alter table public.menu_items
  add constraint menu_items_weekday_range check (weekday between 0 and 6),
  add constraint menu_items_component_valid check (component in ('main','soup')),
  add constraint menu_items_service_valid check (service in ('breakfast','lunch','dinner')),
  add constraint menu_items_soup_is_lunch check (component <> 'soup' or service = 'lunch');
