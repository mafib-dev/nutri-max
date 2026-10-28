-- Módulo de musculação: catálogo de exercícios, rotinas, treinos, séries e PRs.
-- Pesos sempre em kg; a conversão para lb acontece só na interface.

-- Perfil do usuário, compartilhado com o futuro módulo de nutrição.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  goal text check (goal in ('lose', 'gain', 'maintain')),
  level text check (level in ('beginner', 'intermediate', 'expert')),
  display_unit text not null default 'kg' check (display_unit in ('kg', 'lb')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Catálogo: owner_id nulo = exercício do free-exercise-db; preenchido = criado pelo usuário.
create table public.exercises (
  id text primary key,
  owner_id uuid references auth.users (id) on delete cascade,
  name text not null,
  name_pt text,
  force text check (force in ('push', 'pull', 'static')),
  level text check (level in ('beginner', 'intermediate', 'expert')),
  mechanic text check (mechanic in ('compound', 'isolation')),
  equipment text,
  category text not null,
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  instructions jsonb not null default '{}'::jsonb, -- { "en": [...], "pt": [...] }
  images text[] not null default '{}',             -- caminhos no bucket exercise-images
  source text not null default 'free-exercise-db' check (source in ('free-exercise-db', 'custom')),
  created_at timestamptz not null default now(),
  check ((source = 'custom') = (owner_id is not null))
);
create index exercises_owner_idx on public.exercises (owner_id);
create index exercises_primary_muscles_idx on public.exercises using gin (primary_muscles);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  weekday smallint check (weekday between 0 and 6), -- nulo = rotação A/B/C
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
create index routines_user_idx on public.routines (user_id);

create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  position smallint not null,
  sets smallint not null default 3 check (sets > 0),
  rep_min smallint check (rep_min > 0),
  rep_max smallint check (rep_max >= rep_min),
  rest_sec smallint check (rest_sec >= 0),
  superset_group text,
  progression jsonb not null default '{}'::jsonb, -- { "policy": "double", "increment": 2.5, "deloadFactor": 0.9 }
  backup_exercise_id text references public.exercises (id),
  unique (routine_id, position)
);
create index routine_exercises_user_idx on public.routine_exercises (user_id);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  routine_id uuid references public.routines (id) on delete set null,
  name text,
  started_at timestamptz not null,
  ended_at timestamptz,
  body_weight_kg numeric(5, 2),
  note text,
  exclude_from_progression boolean not null default false,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create index workouts_user_started_idx on public.workouts (user_id, started_at desc);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  entry_position smallint not null,
  set_index smallint not null,
  kind text not null default 'work' check (kind in ('warmup', 'work', 'drop', 'restpause', 'failure')),
  weight_kg numeric(6, 2),
  reps smallint check (reps >= 0),
  duration_sec integer check (duration_sec >= 0),
  rir smallint check (rir between 0 and 10),
  side text check (side in ('left', 'right')),
  done boolean not null default false,
  unique (workout_id, entry_position, set_index, side)
);
create index workout_sets_user_exercise_idx on public.workout_sets (user_id, exercise_id);

create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  kind text not null check (kind in ('e1rm', 'weight', 'reps')),
  value numeric(7, 2) not null,
  achieved_at timestamptz not null
);
create index personal_records_user_exercise_idx on public.personal_records (user_id, exercise_id, kind);

-- Peso e medidas: a ponte com o módulo de nutrição.
create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  weight_kg numeric(5, 2),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 0 and 100),
  measurements jsonb not null default '{}'::jsonb,
  unique (user_id, date)
);

-- Sugestões da IA, aprovadas ou recusadas pelo usuário.
create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  module text not null check (module in ('training', 'nutrition', 'general')),
  kind text not null,
  content jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index ai_insights_user_idx on public.ai_insights (user_id, created_at desc);

-- Row Level Security: cada usuário só enxerga e altera o que é seu.
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.personal_records enable row level security;
alter table public.body_metrics enable row level security;
alter table public.ai_insights enable row level security;

create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "catalogue and own exercises are readable" on public.exercises
  for select using (owner_id is null or owner_id = auth.uid());
create policy "insert own exercises" on public.exercises
  for insert with check (owner_id = auth.uid() and source = 'custom');
create policy "update own exercises" on public.exercises
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own exercises" on public.exercises
  for delete using (owner_id = auth.uid());

create policy "own routines" on public.routines
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own routine exercises" on public.routine_exercises
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own workouts" on public.workouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own workout sets" on public.workout_sets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own personal records" on public.personal_records
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own body metrics" on public.body_metrics
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own ai insights" on public.ai_insights
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Cria o perfil assim que o usuário se cadastra.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Última série feita de cada exercício: o que a progressão usa para sugerir a próxima carga.
create view public.last_sets with (security_invoker = true) as
select distinct on (s.user_id, s.exercise_id, s.set_index)
  s.user_id, s.exercise_id, s.set_index, s.kind, s.weight_kg, s.reps, s.rir, w.started_at
from public.workout_sets s
join public.workouts w on w.id = s.workout_id
where s.done and s.kind <> 'warmup' and not w.exclude_from_progression
  and w.started_at = (
    select max(w2.started_at) from public.workouts w2
    join public.workout_sets s2 on s2.workout_id = w2.id
    where s2.user_id = s.user_id and s2.exercise_id = s.exercise_id
      and s2.done and s2.kind <> 'warmup' and not w2.exclude_from_progression
  )
order by s.user_id, s.exercise_id, s.set_index;

-- Volume semanal por músculo (só séries de trabalho concluídas).
create view public.weekly_muscle_volume with (security_invoker = true) as
select
  s.user_id,
  date_trunc('week', w.started_at)::date as week,
  m.muscle,
  count(*) as sets,
  sum(coalesce(s.weight_kg, 0) * coalesce(s.reps, 0)) as volume_kg
from public.workout_sets s
join public.workouts w on w.id = s.workout_id
join public.exercises e on e.id = s.exercise_id
cross join lateral unnest(e.primary_muscles) as m(muscle)
where s.done and s.kind <> 'warmup'
group by s.user_id, week, m.muscle;

-- Fotos do catálogo: bucket público, só leitura para o app.
insert into storage.buckets (id, name, public)
values ('exercise-images', 'exercise-images', true)
on conflict (id) do nothing;
