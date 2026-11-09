-- Plano alimentar por tipo de dia e horário das rotinas de musculação.

-- Horário em que a rotina costuma ser feita: o plano alimentar põe o pré e o pós-treino em volta dele.
alter table public.routines add column time time;

-- Um plano pode ter vários cardápios, um por tipo de dia ("Musculação", "Musculação + Corrida",
-- "Descanso"…). Os cardápios gerados juntos têm o mesmo batch_id; planos antigos têm batch_id nulo
-- e valem para a semana toda.
alter table public.meal_plans
  add column batch_id uuid,
  add column day_name text check (day_name is null or length(day_name) <= 60),
  add column weekdays smallint[] not null default '{0,1,2,3,4,5,6}' check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  add column position smallint not null default 0;
create index meal_plans_batch_idx on public.meal_plans (batch_id) where batch_id is not null;
