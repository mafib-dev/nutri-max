// Ajusta o plano alimentar com o Claude (Anthropic). Recebe o pedido em texto livre e o contexto montado
// pelo app (consulta, metas, cardápio e opções válidas) e devolve as mudanças em JSON. O app
// confere tudo antes de aplicar; as gramas nunca vêm da IA.
//
// Segredo necessário: ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { askClaude } from '../_shared/claude.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const SYSTEM = `Você é um nutricionista esportivo brasileiro ajustando o plano alimentar de um aluno de musculação.
O app já calcula as calorias, os macros e as gramas de cada alimento: você NÃO define quantidades.
Seu trabalho é adaptar o plano à realidade da pessoa a partir do pedido dela: o que ela encontra onde mora,
o que gosta, rotina, orçamento, suplementos e horários.

Você pode mudar:
- "consulta": só os campos que o pedido justificar. Campos: meals (3 a 6), wake, sleep, train ("HH:MM" ou null),
  diet ("omnivore" | "vegetarian"), noLactose, noGluten, noFish, noPork, creatine (booleanos),
  lunchAt ("home" | "lunchbox" | "restaurant"), cooking ("little" | "some" | "plenty"), budget ("low" | "medium" | "high"),
  likes e dislikes (listas COMPLETAS de chaves de "alimentos"; likes = o que tem em casa e prefere, dislikes = o que não come
  ou não encontra), whey ({ "scoops": 0 | 1 | 2, "when": "post" | "breakfast" | "snack" }).
  Não mude meals, horários ou dieta sem pedido explícito.
- "trocas": lista de { "slot", "papel", "alimento" } usando SOMENTE um slot do cardápio e um alimento que esteja em
  opcoes[papel] daquele slot.
- "dicas": até 4 orientações práticas e específicas para a situação da pessoa ({ "titulo", "texto" }, texto com até
  3 frases, em português do Brasil, sem prometer resultados e sem tratar doenças).
- "resumo": 1 a 2 frases dizendo o que você mudou e por quê.

Responda APENAS com um objeto JSON, sem texto antes ou depois: { "resumo": string, "consulta": {...}, "trocas": [...], "dicas": [...] }.
Use somente chaves de alimentos que existam em "alimentos".`

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data } = await supabase.auth.getUser()
  if (!data.user) return json(401, { error: 'Faça login de novo.' })

  let body: { request?: unknown; context?: unknown }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Pedido inválido.' })
  }
  const request = String(body.request ?? '').trim().slice(0, 1000)
  if (!request) return json(400, { error: 'Escreva o que você quer ajustar.' })
  const context = JSON.stringify(body.context ?? {})
  if (context.length > 60000) return json(400, { error: 'Contexto grande demais.' })

  const out = await askClaude(SYSTEM, [{ role: 'user', content: `Plano atual e opções (JSON):\n${context}\n\nPedido da pessoa:\n${request}` }])
  if (!out.ok) return json(out.status, { error: out.error })
  return json(200, { result: out.data })
})
