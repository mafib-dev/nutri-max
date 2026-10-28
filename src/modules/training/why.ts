// A progressão do openGym explica cada sugestão com uma frase em inglês e seus valores
// (`why: [modelo, ...valores]`). Aqui ficam as mesmas frases em português.
const PT: Record<string, string> = {
  'Nothing logged yet, so this session sets the baseline.': 'Nada registrado ainda: este treino define o ponto de partida.',
  'No weight logged last time. Enter what you lift and progression takes it from there.':
    'Nenhuma carga registrada da última vez. Anote o que você levanta e a progressão segue daí.',
  'First time in this routine, so starting from its own target.': 'Primeira vez nesta rotina: começa pela meta dela.',
  'Plan changed, so starting from your new target.': 'O plano mudou: começa pela nova meta.',
  'Short of the target, but more reps than before. Same sets and reps again.':
    'Abaixo da meta, mas com mais repetições que antes. Mesmas séries e repetições de novo.',
  'Bodyweight: every rep last time, so go for {0} this time.': 'Peso corporal: fez todas as repetições, agora tente {0}.',
  'Bodyweight: same target again until every set is clean.': 'Peso corporal: mesma meta até completar todas as séries.',
  'Came up short last time. Same target again.': 'Ficou abaixo da meta da última vez. Mesma meta de novo.',
  'Held every set for the full time. Target goes up by {0}s.': 'Segurou todas as séries pelo tempo todo. A meta sobe {0}s.',
  'Short {0} sessions in a row. Back off to {1}s and build up again.':
    'Abaixo da meta em {0} treinos seguidos. Volte para {1}s e suba de novo.',
  'Every rep last time. {0} {1} more.': 'Fez todas as repetições. Mais {0} {1}.',
  'Every rep last time. {0} {1} less help.': 'Fez todas as repetições. {0} {1} a menos de ajuda.',
  'Last set hit {0} reps, twice the target! Take a double jump of {1} {2}.':
    'A última série chegou a {0} repetições, o dobro da meta! Suba {1} {2} de uma vez.',
  'Missed reps last time. Same weight again ({0} of {1} to go).':
    'Faltaram repetições. Mesma carga de novo (faltam {0} de {1}).',
  'Missed reps last time. Same sets and reps again ({0} of {1} to go).':
    'Faltaram repetições. Mesmas séries e repetições de novo (faltam {0} de {1}).',
  'Missed reps {0} sessions running. Reset to {1} {2} and work back up.':
    'Faltaram repetições em {0} treinos seguidos. Volte para {1} {2} e suba de novo.',
  'Missed reps. Reset to {0} {1} and work back up.': 'Faltaram repetições. Volte para {0} {1} e suba de novo.',
  'Missed reps. {0} {1} of help while you build back up.': 'Faltaram repetições. {0} {1} de ajuda enquanto você recupera.',
  'Same weight, aim for {0} reps this time.': 'Mesma carga, tente {0} repetições agora.',
  'Same weight, aim for {0} reps in every set.': 'Mesma carga, tente {0} repetições em todas as séries.',
  'Same weight, aim for {0} reps on the last set.': 'Mesma carga, tente {0} repetições na última série.',
  'Stuck for {0} sessions. Deload to {1} {2}.': 'Estagnado há {0} treinos. Deload para {1} {2}.',
  'Stuck for {0} sessions. Deload to {1} {2} and start again at {3} sets of {4}.':
    'Estagnado há {0} treinos. Deload para {1} {2} e recomece com {3} séries de {4}.',
  'Stuck for {0} sessions. Epley deload to {1} {2} for {3} reps.':
    'Estagnado há {0} treinos. Deload pela fórmula de Epley para {1} {2} com {3} repetições.',
  'Stuck for {0} sessions. Hold {1} {2} and use {3} reps.': 'Estagnado há {0} treinos. Mantenha {1} {2} e faça {3} repetições.',
  'Stuck for {0} sessions. Back to {1} {2} of help, then build up again.':
    'Estagnado há {0} treinos. Volte para {1} {2} de ajuda e suba de novo.',
  'Stuck for {0} sessions. Back to {1} {2} of help, start again at {3} sets of {4}.':
    'Estagnado há {0} treinos. Volte para {1} {2} de ajuda e recomece com {3} séries de {4}.',
  'Top of the rep range in every set. {0} {1} more, back to {2} reps.':
    'Topo da faixa em todas as séries. Mais {0} {1} e volte para {2} repetições.',
  'Top of the rep range in every set. {0} {1} less help, back to {2} reps.':
    'Topo da faixa em todas as séries. {0} {1} a menos de ajuda e volte para {2} repetições.',
  'Top of the range on all {0} sets. {1} {2} more, back to {3} sets of {4}.':
    'Topo da faixa nas {0} séries. Mais {1} {2} e volte para {3} séries de {4}.',
  'Top of the range on all {0} sets. {1} {2} less help, back to {3} sets of {4}.':
    'Topo da faixa nas {0} séries. {1} {2} a menos de ajuda e volte para {3} séries de {4}.',
  '{0} reps in every set! Add a set and go back to {1}.': '{0} repetições em todas as séries! Adicione uma série e volte para {1}.',
  '{0} reps in every set! Add a set at {1} reps.': '{0} repetições em todas as séries! Adicione uma série de {1}.',
  '{0} sets of {1}. Time to add weight or try a harder variation.':
    '{0} séries de {1}. Hora de colocar carga ou tentar uma variação mais difícil.',
  'You’ve outgrown the rack: {0} {1} is your heaviest dumbbell, so the weight stays.':
    'Você chegou no limite: {0} {1} é o seu halter mais pesado, então a carga fica.',
  'That’s the whole stack: {0} {1} is the heaviest it goes, so the weight stays.':
    'Esse é o máximo da máquina: {0} {1}, então a carga fica.',
}

/** A explicação da sugestão em português, com os valores preenchidos. */
export function explain(why: readonly unknown[] | undefined): string {
  if (!why?.length) return ''
  const [template, ...args] = why
  let text = PT[String(template)] ?? String(template)
  args.forEach((arg, i) => {
    const value = typeof arg === 'number' ? arg.toLocaleString('pt-BR') : String(arg)
    text = text.replaceAll(`{${i}}`, value)
  })
  return text
}
