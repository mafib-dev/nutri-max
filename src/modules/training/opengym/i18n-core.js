// Substitui o i18n-core.js do openGym. A lógica portada só usa estas funções para montar
// textos; o NutriMax traduz na interface, então aqui elas devolvem a frase com os {0}
// preenchidos.

export const dateLocale = () => 'pt-BR'

export function t(s, ...args) {
  let v = s
  for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
  return v
}

export function tn(one, other, n, ...rest) {
  return t(n === 1 ? one : other, n, ...rest)
}

export const exerciseNameFor = ex => ex?.n || ''

export const exerciseNameClass = () => ''
