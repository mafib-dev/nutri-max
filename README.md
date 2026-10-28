# NutriMax

Aplicação de saúde com treino e nutrição acompanhados por IA. Web, instalável como PWA,
com Supabase como backend.

Este primeiro passo é a base do **módulo de musculação**: estrutura do projeto, schema do
banco e importação do catálogo de exercícios.

## Stack

- React 19 + Vite + TypeScript, com `vite-plugin-pwa`
- Supabase: Postgres com Row Level Security, Auth e Storage
- Vitest para os testes

## Como rodar

Precisa de Node 22 e de [Docker](https://docs.docker.com/get-docker/) para o Supabase local.

```bash
npm install
npx supabase start          # sobe o Supabase local e aplica as migrations
cp .env.example .env        # preencha as chaves que o comando acima mostrou
npm run import:exercises    # carrega os 876 exercícios e as fotos
npm run dev
```

Para usar um projeto Supabase na nuvem, `npx supabase link` e `npx supabase db push`
aplicam as mesmas migrations.

## Estrutura

```
src/
  lib/supabase.ts             cliente do Supabase
  modules/training/           módulo de musculação
    muscles.ts                os 18 músculos acompanhados e o mapeamento do free-exercise-db
    catalogue.ts              conversão de um exercício para a tabela exercises
supabase/migrations/          schema do banco (tabelas, RLS, views)
scripts/import-exercises.ts   importação do catálogo
```

## Banco de dados

| Tabela | Para que serve |
| --- | --- |
| `profiles` | Dados do usuário, criados no cadastro |
| `exercises` | Catálogo do free-exercise-db e exercícios criados pelo usuário |
| `routines`, `routine_exercises` | O plano de treino e o que cada treino prescreve |
| `workouts`, `workout_sets` | Cada sessão e cada série registrada |
| `personal_records` | Recordes pessoais |
| `body_metrics` | Peso e medidas, compartilhados com o módulo de nutrição |
| `ai_insights` | Sugestões da IA, aprovadas ou recusadas pelo usuário |

Views: `last_sets` (última série de cada exercício, usada pela progressão) e
`weekly_muscle_volume` (volume semanal por músculo).

Pesos são sempre gravados em kg.

## Créditos

- Exercícios e fotos: [free-exercise-db](https://github.com/yuhonas/free-exercise-db), domínio público.
- A lógica de treino que será portada nas próximas etapas vem do
  [openGym](https://github.com/DuarteSantos8/openGym), sob AGPL-3.0.
