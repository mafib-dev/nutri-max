-- Plano alimentar: as respostas da consulta (refeições, horários, treino, restrições) e as
-- trocas escolhidas. O cardápio é recalculado no app a partir disso e das metas do dia.
alter table public.profiles
  add column meal_plan jsonb check (meal_plan is null or jsonb_typeof(meal_plan) = 'object');
