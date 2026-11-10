-- Uma rotina pode cair em mais de um dia da semana (ex.: Treino A na segunda e na quinta).
-- A coluna antiga `weekday` continua, com o primeiro dia, para versões anteriores do app.
alter table public.routines
  add column weekdays smallint[] not null default '{}'
  check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);

update public.routines set weekdays = array[weekday] where weekday is not null;
