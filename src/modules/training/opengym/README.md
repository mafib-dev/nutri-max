# Lógica de treino do openGym

Os arquivos `.js` desta pasta vêm do [openGym](https://github.com/DuarteSantos8/openGym)
(`frontend/src/lib`, versão 1.4.3, commit `b6cfe2b`), de Duarte Santos, sob a licença
**AGPL-3.0-or-later** (texto em [LICENSE](LICENSE)). Uso pessoal não gera obrigação; se o
NutriMax for distribuído ou oferecido a outras pessoas, o código-fonte precisa ser publicado
sob a mesma licença.

## O que veio sem mudanças

`progression.js`, `onerm.js`, `workout-model.js`, `finish-workout.js`, `history.js` e o que
eles importam: `dumbbells.js`, `rep-range.js`, `pyramid.js`, `backoff.js`, `format.js`,
`speed.js`, `incline.js`, `bar.js`, `queue.js`, `superset-meta.js`. Para a recuperação
muscular: `recovery.js`, `recovery-view.js`, `muscles.js` e `effort.js`. Os testes `*.test.js`
que só dependem desses arquivos também vieram.

## O que foi trocado

- `exercises.js`: no openGym o catálogo vem embutido no app. Aqui ele é preenchido com
  `registerCatalogue()` a partir da tabela `exercises` do Supabase. As regras de equipamento,
  máquina assistida e incremento padrão são as mesmas. `smOf` não tem os acréscimos manuais de
  músculos secundários que o openGym aplica a alguns exercícios.
- `i18n-core.js`: versão mínima que só preenche os `{0}` das frases, com datas e números em pt-BR.
- `test-catalogue.json` e `test-setup.js`: os 24 exercícios do catálogo do openGym que os
  testes usam pelo id.
- Testes de `format.helpers.test.js` e `history.test.js` que conferiam datas e números em
  inglês agora esperam o formato pt-BR, assim como um teste de `recovery-view.test.js`.

Ficaram de fora os testes que dependem de partes não portadas (início de sessão,
compartilhamento de plano, importação de CSV, traduções).

## Como usar

Não importe estes arquivos direto na interface: use `../state.ts`, que monta o estado a partir
do Supabase e expõe `suggestNext`, `bestEstimated1RM` e `estimated1RMSeries` com tipos.
