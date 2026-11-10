-- Em que refeição do plano do dia o lançamento entrou (o diário passa a ter as refeições do plano).
alter table public.food_logs add column if not exists plan_meal text;
