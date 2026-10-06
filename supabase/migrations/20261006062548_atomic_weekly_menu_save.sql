create or replace function public.save_weekly_menu_atomic(p_head jsonb, p_items jsonb)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id text := p_head->>'id';
begin
  if v_id is null or v_id = '' then
    raise exception 'weekly menu id is required';
  end if;

  insert into public.weekly_menus (
    id, year, week_number, parity, camp_id, diners, supply_arrival_weekday,
    actual_start_date, actual_end_date, status, validation_score, variety_score,
    seed, notes, created_at, schedule_shift_days
  ) values (
    v_id,
    (p_head->>'year')::integer,
    (p_head->>'week_number')::integer,
    p_head->>'parity',
    p_head->>'camp_id',
    (p_head->>'diners')::integer,
    (p_head->>'supply_arrival_weekday')::smallint,
    nullif(p_head->>'actual_start_date','')::date,
    nullif(p_head->>'actual_end_date','')::date,
    coalesce(p_head->>'status','borrador'),
    coalesce((p_head->>'validation_score')::integer,0),
    coalesce((p_head->>'variety_score')::integer,0),
    p_head->>'seed',
    p_head->>'notes',
    coalesce((p_head->>'created_at')::timestamptz,now()),
    coalesce((p_head->>'schedule_shift_days')::integer,0)
  )
  on conflict (id) do update set
    year=excluded.year,
    week_number=excluded.week_number,
    parity=excluded.parity,
    camp_id=excluded.camp_id,
    diners=excluded.diners,
    supply_arrival_weekday=excluded.supply_arrival_weekday,
    actual_start_date=excluded.actual_start_date,
    actual_end_date=excluded.actual_end_date,
    status=excluded.status,
    validation_score=excluded.validation_score,
    variety_score=excluded.variety_score,
    seed=excluded.seed,
    notes=excluded.notes,
    schedule_shift_days=excluded.schedule_shift_days;

  delete from public.menu_items where weekly_menu_id=v_id;

  insert into public.menu_items (
    weekly_menu_id, weekday, service, component, recipe_id, protein_id,
    salad_recipe_id, beverage, locked, reasons, execution_status,
    replacement_name, salad_execution_status, beverage_execution_status
  )
  select
    v_id,
    (x->>'weekday')::smallint,
    x->>'service',
    x->>'component',
    x->>'recipe_id',
    x->>'protein_id',
    x->>'salad_recipe_id',
    x->>'beverage',
    coalesce((x->>'locked')::boolean,false),
    coalesce(x->'reasons','[]'::jsonb),
    coalesce(x->>'execution_status','pending'),
    x->>'replacement_name',
    coalesce(x->>'salad_execution_status','pending'),
    coalesce(x->>'beverage_execution_status','pending')
  from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) as x;

  return v_id;
end;
$$;

revoke all on function public.save_weekly_menu_atomic(jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.save_weekly_menu_atomic(jsonb,jsonb) to service_role;
