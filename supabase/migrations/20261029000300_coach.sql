-- Conversa com o nutricionista (IA). Cada mensagem guarda quem falou, o texto e, nas respostas da
-- IA, as ações sugeridas (ajustar o plano, lançar uma refeição, registrar água) e se já foram aplicadas.
create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(content) between 1 and 4000),
  actions jsonb not null default '[]'::jsonb check (jsonb_typeof(actions) = 'array'),
  created_at timestamptz not null default now()
);
create index coach_messages_user_idx on public.coach_messages (user_id, created_at desc);

alter table public.coach_messages enable row level security;
create policy "own coach messages" on public.coach_messages
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
