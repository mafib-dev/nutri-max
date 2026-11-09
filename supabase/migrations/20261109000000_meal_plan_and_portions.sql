-- Medidas caseiras dos alimentos e plano alimentar gerado pelo app.

-- Medidas caseiras: [{ name, plural, g, whole? }], ex.: { "name": "concha", "plural": "conchas", "g": 80 }.
-- whole = conta-se inteiro (ovo, pão, banana): o plano arredonda para unidades.
-- Os da TACO são carregados por `npm run import:foods`.
alter table public.foods
  add column portions jsonb not null default '[]'::jsonb check (jsonb_typeof(portions) = 'array');

-- Como a quantidade foi registrada em medida caseira ("2 conchas"), para mostrar no diário.
alter table public.food_logs
  add column measure text check (measure is null or length(measure) <= 60);

-- Plano alimentar: o cardápio fica congelado como foi gerado (metas, alimentos, trocas,
-- orientações e lista de compras); mudar as metas depois não altera o plano salvo.
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  settings jsonb not null,
  plan jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meal_plans_user_idx on public.meal_plans (user_id, created_at desc);

alter table public.meal_plans enable row level security;
create policy "own meal plans" on public.meal_plans
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
