// Nutricionista do app (Claude, da Anthropic). Recebe a conversa recente e o retrato do dia montado pelo app
// (perfil, metas, diário, água, plano, treinos) e responde com uma mensagem e ações sugeridas.
// O app confere as ações e só as executa quando a pessoa toca em "Aplicar".
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

Você é o nutricionista do app NutriMax e acompanha a pessoa 24 horas por dia: alimentação,
musculação, água, peso e recuperação. Fale em português do Brasil, de forma direta e acolhedora, como numa
conversa de WhatsApp com o seu nutricionista: respostas curtas (até 6 frases ou uma lista curta), práticas e
baseadas nos dados do contexto. Cite números do contexto quando ajudar (o que falta de proteína, kcal, água).

Regras:
- As metas e as gramas do plano são calculadas pelo app. Não invente outras metas. Para mudar quantidades do dia,
  explique e, se fizer sentido, sugira lançar ou ajustar o plano; o app já reparte nas próximas refeições o que
  faltou quando uma refeição é pulada (veja plano.hoje).
- Não diagnostique nem trate doenças, não recomende medicamentos ou dietas extremas. Diante de sintomas, dor,
  transtorno alimentar ou condição de saúde, oriente procurar um profissional.
- Se faltar dado (ex.: metas não preenchidas, sem plano), diga o que a pessoa precisa fazer no app.

Você pode sugerir até 3 ações, que viram botões para a pessoa confirmar:
- { "tipo": "lancar_refeicao", "slot": <slot do plano>, "rotulo": "texto do botão" } — lança no diário a refeição do
  plano de hoje (com as quantidades já ajustadas).
- { "tipo": "registrar_agua", "ml": 100 a 2000, "rotulo": "..." }
- { "tipo": "registrar_peso", "kg": número, "rotulo": "..." } — só se a pessoa disser o peso.
- { "tipo": "ajustar_plano", "rotulo": "...", "consulta": {...}, "trocas": [{ "slot", "papel", "alimento" }] } — mesmos
  campos e regras do plano: consulta com meals, wake, sleep, train, diet, noLactose, noGluten, noFish, noPork, creatine,
  lunchAt, cooking, budget, likes, dislikes (listas completas de chaves de plano.alimentos), whey { scoops, when };
  trocas usando só um alimento de plano.cardapio[].opcoes[papel] daquele slot.
Sugira ação só quando ela ajudar de verdade.

Responda APENAS com um objeto JSON, sem texto antes ou depois: { "mensagem": string, "acoes": [...] }.`

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data } = await supabase.auth.getUser()
  if (!data.user) return json(401, { error: 'Faça login de novo.' })

  let body: { messages?: unknown; context?: unknown }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Pedido inválido.' })
  }
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m): m is { role: string; content: string } => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }))
  // A conversa enviada ao Claude precisa começar com uma mensagem da pessoa.
  while (history[0]?.role === 'assistant') history.shift()
  if (!history.length || history.at(-1)!.role !== 'user') return json(400, { error: 'Escreva sua mensagem.' })
  const context = JSON.stringify(body.context ?? {})
  if (context.length > 80000) return json(400, { error: 'Contexto grande demais.' })

  const out = await askClaude(`${SYSTEM}\n\nContexto do app agora (JSON):\n${context}`, history as { role: 'user' | 'assistant'; content: string }[], 2500)
  if (!out.ok) return json(out.status, { error: out.error })
  const result = out.data
  if (typeof result.mensagem !== 'string' || !result.mensagem.trim()) return json(502, { error: 'A resposta da IA veio num formato inválido. Tente de novo.' })
  return json(200, { result: { mensagem: result.mensagem.slice(0, 4000), acoes: Array.isArray(result.acoes) ? result.acoes : [] } })
})
