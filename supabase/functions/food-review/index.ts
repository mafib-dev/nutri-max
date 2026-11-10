// Avalia um alimento que a pessoa colocou nas preferências do plano. Só opina: diz se combina,
// por que, e sugere alternativas da lista que o app manda. Quem muda a lista é a pessoa.
//
// Segredo necessário: ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { askClaude } from '../_shared/claude.ts'
import { NUTRITIONIST } from '../_shared/persona.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const SYSTEM = `${NUTRITIONIST}

Aqui a pessoa escolheu UM alimento da tabela para entrar no plano alimentar dela. Você avalia essa escolha como
faria no consultório, mas NÃO muda nada: a decisão é dela.

Considere o objetivo, as metas do dia, as condições de saúde, alergias e restrições, o treino, e o próprio alimento
(calorias, proteína, gordura, fibra e características como "muito sódio" ou "sobe a glicose rápido").
Seja equilibrado: alimento in natura ou pouco processado que cabe no objetivo é "ok", mesmo que não seja o ideal.
Use "atencao" quando dá para comer, mas com um cuidado (porção, frequência, sódio, gordura, glicose).
Use "evitar" só quando vai contra uma condição de saúde, alergia ou restrição dela, ou atrapalha muito o objetivo.

Responda APENAS com um objeto JSON, sem texto antes ou depois:
{ "veredito": "ok" | "atencao" | "evitar", "motivo": string, "sugestoes": [chaves] }
- "motivo": 1 a 2 frases simples, em português do Brasil, dizendo o porquê para ESTA pessoa. Quando for "ok", diga em
  que ele ajuda. Sem prometer resultados e sem tratar doenças.
- "sugestoes": vazio quando "ok"; senão até 3 chaves de "alternativas", das melhores para a pessoa.`

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data } = await supabase.auth.getUser()
  if (!data.user) return json(401, { error: 'Faça login de novo.' })

  let body: { context?: unknown }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Pedido inválido.' })
  }
  const context = JSON.stringify(body.context ?? {})
  if (context.length < 20 || context.length > 20000) return json(400, { error: 'Contexto inválido.' })

  const out = await askClaude(SYSTEM, [{ role: 'user', content: `Avalie esta escolha (JSON):\n${context}` }], 1500)
  if (!out.ok) return json(out.status, { error: out.error })
  return json(200, { result: out.data })
})
