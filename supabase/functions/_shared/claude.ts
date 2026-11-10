// Chamada ao Claude (Anthropic) usada pelas funções de IA do app. Devolve o objeto JSON que o
// modelo escreveu ou uma mensagem de erro em português para mostrar na tela.
//
// Segredo necessário: ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets).
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0'

export const MODEL = 'claude-opus-5-5'

type Result = { ok: true; data: Record<string, unknown> } | { ok: false; status: number; error: string }

export async function askClaude(system: string, messages: Anthropic.Beta.BetaMessageParam[], maxTokens = 4000): Promise<Result> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return { ok: false, status: 500, error: 'A chave da Anthropic não está configurada no Supabase (ANTHROPIC_API_KEY).' }
  const client = new Anthropic({ apiKey, maxRetries: 1 })

  let res: Anthropic.Beta.BetaMessage
  try {
    res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      output_config: { effort: 'medium' },
      // Se o modelo recusar por engano, a própria API tenta de novo com outro modelo.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages,
    })
  } catch (err) {
    console.error('anthropic', err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : String(err))
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, status: 502, error: 'A chave da Anthropic foi recusada.' }
    if (err instanceof Anthropic.PermissionDeniedError) return { ok: false, status: 502, error: 'A chave da Anthropic não tem permissão para usar o Claude.' }
    if (err instanceof Anthropic.RateLimitError) return { ok: false, status: 429, error: 'Muitos pedidos seguidos. Espere um pouco e tente de novo.' }
    if (err instanceof Anthropic.BadRequestError) return { ok: false, status: 502, error: 'A Anthropic recusou o pedido (confira se a conta tem créditos).' }
    return { ok: false, status: 502, error: 'O Claude não respondeu. Tente de novo.' }
  }

  if (res.stop_reason === 'refusal') return { ok: false, status: 422, error: 'A IA não pôde responder a esse pedido. Tente escrever de outro jeito.' }
  const text = res.content.map(b => (b.type === 'text' ? b.text : '')).join('')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  try {
    const data = JSON.parse(text.slice(start, end + 1))
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('não é objeto')
    return { ok: true, data }
  } catch {
    console.error('anthropic json', res.stop_reason, text.slice(0, 300))
    return { ok: false, status: 502, error: 'A resposta da IA veio num formato inválido. Tente de novo.' }
  }
}
