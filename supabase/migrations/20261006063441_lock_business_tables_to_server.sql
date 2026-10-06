drop policy if exists beta_all on public.camp_product_availability;
drop policy if exists beta_all on public.camps;
drop policy if exists beta_all on public.ingredients;
drop policy if exists beta_all on public.menu_items;
drop policy if exists beta_all on public.proteins;
drop policy if exists beta_all on public.recipe_restrictive_products;
drop policy if exists beta_all on public.recipe_services;
drop policy if exists beta_all on public.recipes;
drop policy if exists beta_all on public.restrictive_products;
drop policy if exists beta_all on public.weekly_menus;
drop policy if exists beta_all on public.zones;

revoke all on table public.camp_product_availability from anon, authenticated;
revoke all on table public.camps from anon, authenticated;
revoke all on table public.ingredients from anon, authenticated;
revoke all on table public.menu_items from anon, authenticated;
revoke all on table public.proteins from anon, authenticated;
revoke all on table public.recipe_restrictive_products from anon, authenticated;
revoke all on table public.recipe_services from anon, authenticated;
revoke all on table public.recipes from anon, authenticated;
revoke all on table public.restrictive_products from anon, authenticated;
revoke all on table public.weekly_menus from anon, authenticated;
revoke all on table public.zones from anon, authenticated;

revoke all on sequence public.menu_items_id_seq from anon, authenticated;
