-- Cardio: corrida, caminhada, bicicleta, natação e outras atividades, com distância, tempo,
-- intensidade e intervalos. Planos dizem o que fazer em quais dias; registros guardam o que foi feito.

-- Intervalos: { "reps": 6, "work_m": 400, "work_sec": null, "rest_sec": 120 }
-- (cada tiro tem distância ou tempo; o descanso é em segundos).

create table public.cardio_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  activity text not null check (activity in ('run', 'walk', 'bike', 'swim', 'row', 'elliptical', 'hike', 'jump_rope', 'other')),
  weekdays smallint[] not null default '{}' check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  time time,
  distance_m integer check (distance_m > 0),
  duration_sec integer check (duration_sec > 0),
  intensity text not null default 'easy' check (intensity in ('easy', 'moderate', 'hard')),
  intervals jsonb check (intervals is null or jsonb_typeof(intervals) = 'object'),
  -- Progressão por sessão feita: { "step_m": 500, "max_m": 8000 }.
  progression jsonb not null default '{}'::jsonb check (jsonb_typeof(progression) = 'object'),
  notes text,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
create index cardio_plans_user_idx on public.cardio_plans (user_id);

create table public.cardio_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid references public.cardio_plans (id) on delete set null,
  date date not null,
  activity text not null check (activity in ('run', 'walk', 'bike', 'swim', 'row', 'elliptical', 'hike', 'jump_rope', 'other')),
  name text not null check (length(trim(name)) > 0),
  distance_m integer check (distance_m > 0),
  duration_sec integer not null check (duration_sec between 1 and 86400),
  intensity text not null default 'easy' check (intensity in ('easy', 'moderate', 'hard')),
  intervals jsonb check (intervals is null or jsonb_typeof(intervals) = 'object'),
  rpe smallint check (rpe between 1 and 10),
  avg_hr smallint check (avg_hr between 30 and 250),
  -- Gasto da atividade: estimado pelo app ou copiado do relógio.
  kcal integer not null check (kcal >= 0),
  kcal_from_device boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create index cardio_logs_user_date_idx on public.cardio_logs (user_id, date desc);
create index cardio_logs_plan_idx on public.cardio_logs (plan_id, date desc) where plan_id is not null;

alter table public.cardio_plans enable row level security;
alter table public.cardio_logs enable row level security;

create policy "own cardio plans" on public.cardio_plans
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own cardio logs" on public.cardio_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
