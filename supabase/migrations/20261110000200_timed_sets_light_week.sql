-- Séries por tempo (prancha, isometria) e semana leve programada.

-- 'time': cada série tem uma duração (workout_sets.duration_sec) em vez de repetições;
-- target_sec é a meta, que a progressão "por tempo" aumenta.
alter table public.routine_exercises
  add column mode text not null default 'reps' check (mode in ('reps', 'time')),
  add column target_sec smallint check (target_sec between 5 and 3600);

-- Semana leve: menos séries e carga na musculação, cardio sem tiros nem progressão.
-- Automática a cada N semanas (contadas a partir de light_week_start) ou ligada à mão até uma data.
alter table public.profiles
  add column light_week_every smallint check (light_week_every between 2 and 12),
  add column light_week_start date,
  add column light_week_until date;
