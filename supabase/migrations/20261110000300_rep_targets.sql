-- Repetições por série (pirâmide, ex.: 12-10-8): uma meta para cada série, em ordem.
-- Nulo = todas as séries com a mesma faixa (rep_min–rep_max).
alter table public.routine_exercises
  add column rep_targets smallint[] check (
    rep_targets is null
    or (cardinality(rep_targets) between 1 and 10 and 0 < all (rep_targets) and 1000 > all (rep_targets))
  );
