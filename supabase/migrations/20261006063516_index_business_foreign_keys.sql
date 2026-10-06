create index if not exists idx_camp_product_availability_product
  on public.camp_product_availability(product_id);
create index if not exists idx_menu_items_protein
  on public.menu_items(protein_id);
create index if not exists idx_menu_items_recipe
  on public.menu_items(recipe_id);
create index if not exists idx_menu_items_salad_recipe
  on public.menu_items(salad_recipe_id);
create index if not exists idx_recipe_restrictive_products_product
  on public.recipe_restrictive_products(restrictive_product_id);
