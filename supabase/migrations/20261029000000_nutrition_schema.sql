-- Módulo de nutrição: alimentos (TACO + criados pelo usuário), diário de refeições e metas.
-- Valores dos alimentos sempre por 100 g.

-- Dados para calcular o gasto calórico e metas definidas à mão (nulas = calculadas).
alter table public.profiles
  add column sex text check (sex in ('male', 'female')),
  add column birth_date date,
  add column height_cm numeric(5, 1) check (height_cm between 100 and 250),
  add column activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  add column kcal_target integer check (kcal_target between 800 and 6000),
  add column protein_target_g integer check (protein_target_g between 0 and 500),
  add column carbs_target_g integer check (carbs_target_g between 0 and 1000),
  add column fat_target_g integer check (fat_target_g between 0 and 400);

-- Catálogo: owner_id nulo = Tabela Brasileira de Composição de Alimentos (TACO, NEPA/UNICAMP),
-- carregada por `npm run import:foods`.
create table public.foods (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text,
  kcal numeric(6, 1) not null check (kcal >= 0),
  protein_g numeric(5, 1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(5, 1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(5, 1) not null default 0 check (fat_g >= 0),
  fiber_g numeric(5, 1) check (fiber_g >= 0),
  sodium_mg numeric(7, 1) check (sodium_mg >= 0),
  serving_name text,                        -- ex.: "1 scoop", "1 unidade"
  serving_g numeric(6, 1) check (serving_g > 0),
  source text not null default 'taco' check (source in ('taco', 'custom')),
  created_at timestamptz not null default now(),
  check ((source = 'custom') = (owner_id is not null))
);
create index foods_owner_idx on public.foods (owner_id);

-- Cada alimento comido. Nome e macros são copiados na hora: editar ou apagar o alimento
-- depois não muda o que já foi registrado.
create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'snack', 'dinner')),
  food_id text references public.foods (id) on delete set null,
  name text not null,
  grams numeric(6, 1) not null check (grams > 0),
  kcal numeric(7, 1) not null,
  protein_g numeric(6, 1) not null,
  carbs_g numeric(6, 1) not null,
  fat_g numeric(6, 1) not null,
  created_at timestamptz not null default now()
);
create index food_logs_user_date_idx on public.food_logs (user_id, date);

alter table public.foods enable row level security;
alter table public.food_logs enable row level security;

create policy "catalogue and own foods are readable" on public.foods
  for select using (owner_id is null or owner_id = auth.uid());
create policy "insert own foods" on public.foods
  for insert with check (owner_id = auth.uid() and source = 'custom');
create policy "update own foods" on public.foods
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid() and source = 'custom');
create policy "delete own foods" on public.foods
  for delete using (owner_id = auth.uid());

create policy "own food logs" on public.food_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
