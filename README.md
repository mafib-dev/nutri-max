# NutriMax

Aplicação de saúde com treino e nutrição acompanhados por IA. Web, instalável como PWA,
com Supabase como backend.

O **módulo de musculação** já tem login, catálogo de exercícios, rotinas, registro do treino
com carga sugerida pela progressão, histórico e evolução do 1RM por exercício.

O **módulo de nutrição** tem o diário de refeições com os 597 alimentos da tabela TACO,
alimentos próprios (copiados do rótulo) e metas de calorias e macros calculadas pelo perfil.

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
  pages/                      telas (Hoje, Rotinas, Exercícios, Treino, Nutrição, Histórico, Progresso)
  components/                 componentes compartilhados (busca de exercícios e de alimentos)
  lib/                        cliente do Supabase, login, formatação
  modules/training/           módulo de musculação
    muscles.ts                os 18 músculos acompanhados e o mapeamento do free-exercise-db
    catalogue.ts              conversão de um exercício para a tabela exercises
    state.ts                  monta o histórico do Supabase e sugere a próxima carga
    session.ts                treino em andamento: séries, gravação e recordes
    data.ts                   leituras e gravações no Supabase
    why.ts                    explicação da sugestão de carga em português
    opengym/                  lógica de treino portada do openGym (AGPL-3.0)
  modules/nutrition/          módulo de nutrição
    targets.ts                gasto calórico (Mifflin-St Jeor) e divisão dos macros
    foods.ts                  macros por porção, totais e busca de alimentos
    data.ts                   leituras e gravações no Supabase
supabase/migrations/          schema do banco (tabelas, RLS, views)
scripts/import-exercises.ts   importação do catálogo
```

## Banco de dados

| Tabela | Para que serve |
| --- | --- |
| `profiles` | Dados do usuário, criados no cadastro, e as metas de nutrição |
| `exercises` | Catálogo do free-exercise-db e exercícios criados pelo usuário |
| `routines`, `routine_exercises` | O plano de treino e o que cada treino prescreve |
| `workouts`, `workout_sets` | Cada sessão e cada série registrada |
| `personal_records` | Recordes pessoais |
| `body_metrics` | Peso e medidas, compartilhados com o módulo de nutrição |
| `foods` | Alimentos da TACO (por 100 g) e alimentos criados pelo usuário |
| `food_logs` | O que foi comido, por dia e refeição, com os macros copiados na hora |
| `ai_insights` | Sugestões da IA, aprovadas ou recusadas pelo usuário |

Views: `last_sets` (última série de cada exercício, usada pela progressão) e
`weekly_muscle_volume` (volume semanal por músculo).

Pesos são sempre gravados em kg.

## Créditos

- Alimentos: [TACO, Tabela Brasileira de Composição de Alimentos](https://nepa.unicamp.br/publicacoes/tabela-taco-pdf/), 4ª edição, NEPA/UNICAMP,
  a partir dos dados organizados pelo [taco-api](https://github.com/raulfdm/taco-api) (MIT).
- Exercícios e fotos: [free-exercise-db](https://github.com/yuhonas/free-exercise-db), domínio público.
- A lógica de treino em `src/modules/training/opengym` vem do
  [openGym](https://github.com/DuarteSantos8/openGym), sob AGPL-3.0. Detalhes no README da pasta.
