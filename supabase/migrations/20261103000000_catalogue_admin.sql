-- Catálogo NutriMax: alimentos que não estão na TACO, cadastrados por um administrador
-- (pela página /admin/alimentos) e visíveis para todo mundo, como os da TACO.

create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
-- Cada um só consegue ver se ele mesmo é administrador. Ninguém entra pela API:
-- a lista é mantida direto no banco.
create policy "see own admin row" on public.app_admins for select using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid())
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Nova origem 'nutrimax': do catálogo (sem dono), mas editável pelo administrador.
alter table public.foods drop constraint foods_source_check;
alter table public.foods add constraint foods_source_check check (source in ('taco', 'custom', 'nutrimax'));
alter table public.foods add column updated_at timestamptz;

-- Um código de barras aparece uma vez só no catálogo.
create unique index foods_catalogue_barcode_key on public.foods (barcode) where owner_id is null and barcode is not null;

create policy "admins insert catalogue foods" on public.foods
  for insert to authenticated with check (owner_id is null and source = 'nutrimax' and (select public.is_admin()));
create policy "admins update catalogue foods" on public.foods
  for update to authenticated using (owner_id is null and source = 'nutrimax' and (select public.is_admin()))
  with check (owner_id is null and source = 'nutrimax' and (select public.is_admin()));
create policy "admins delete catalogue foods" on public.foods
  for delete to authenticated using (owner_id is null and source = 'nutrimax' and (select public.is_admin()));
