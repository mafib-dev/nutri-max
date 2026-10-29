-- Ideias trazidas do OpenNutriTracker: código de barras, adição rápida, peso-alvo,
-- calorias do treino, refeições salvas, água e fibra/sódio do dia.

-- Produtos lidos do Open Food Facts viram alimentos do usuário, achados pelo código.
alter table public.foods add column barcode text check (barcode ~ '^[0-9]{8,14}$');
create index foods_barcode_idx on public.foods (owner_id, barcode) where barcode is not null;

-- Adição rápida: só calorias e macros, sem alimento nem gramas.
-- Fibra e sódio copiados na hora, como os macros.
alter table public.food_logs
  alter column grams drop not null,
  add column fiber_g numeric(6, 1),
  add column sodium_mg numeric(8, 1);

alter table public.profiles
  add column target_weight_kg numeric(5, 1) check (target_weight_kg between 30 and 300),
  add column weekly_rate_kg numeric(3, 2) check (weekly_rate_kg between 0.1 and 1),
  add column add_workout_kcal boolean not null default false;

-- Refeições montadas uma vez e lançadas de novo com um toque.
-- items: [{ food_id, name, grams, kcal, protein_g, carbs_g, fat_g, fiber_g, sodium_mg }]
create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  created_at timestamptz not null default now()
);
create index saved_meals_user_idx on public.saved_meals (user_id);

-- Água do dia, em ml.
create table public.water_logs (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  ml integer not null default 0 check (ml between 0 and 20000),
  primary key (user_id, date)
);

alter table public.saved_meals enable row level security;
alter table public.water_logs enable row level security;

create policy "own saved meals" on public.saved_meals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own water logs" on public.water_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
