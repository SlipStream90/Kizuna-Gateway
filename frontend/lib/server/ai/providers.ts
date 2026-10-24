import Anthropic from '@anthropic-ai/sdk'

/**
 * One interface over the AI providers an organisation can bring its own key for.
 * Keys are passed in per call (read from Vault by the caller) and never stored here.
 */

export const PROVIDER_IDS = ['groq', 'anthropic', 'openai'] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]

export type ProviderInfo = {
  id: ProviderId
  label: string
  defaultModel: string
  keyPrefix: string
  consoleUrl: string
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  groq: { id: 'groq', label: 'Groq', defaultModel: 'openai/gpt-oss-120b', keyPrefix: 'gsk_', consoleUrl: 'https://console.groq.com/keys' },
  anthropic: { id: 'anthropic', label: 'Anthropic (Claude)', defaultModel: 'claude-opus-5-5', keyPrefix: 'sk-ant-', consoleUrl: 'https://console.anthropic.com/settings/keys' },
  openai: { id: 'openai', label: 'OpenAI', defaultModel: 'gpt-5', keyPrefix: 'sk-', consoleUrl: 'https://platform.openai.com/api-keys' },
}

const OPENAI_COMPATIBLE_BASE: Partial<Record<ProviderId, string>> = {
  groq: 'https://api.groq.com/openai/v1',
  openai: 'https://api.openai.com/v1',
}

export const isProviderId = (v: string): v is ProviderId => (PROVIDER_IDS as readonly string[]).includes(v)

/** Same shape the database accepts (set_ai_credential), checked before any network call. */
export function keyShapeError(key: unknown): string | null {
  if (typeof key !== 'string') return 'key is required'
  const k = key.trim()
  if (k.length < 16 || k.length > 512 || /\s/.test(k)) return 'that does not look like an API key'
  return null
}

export type VerifyResult = { ok: true; reason?: undefined } | { ok: false; reason: 'rejected' | 'unreachable'; status?: number }

type Deps = { fetch?: typeof fetch }

/** Cheapest authenticated call each provider offers (list models). Spends no tokens. */
export async function verifyKey(provider: ProviderId, key: string, deps: Deps = {}): Promise<VerifyResult> {
  const doFetch = deps.fetch ?? fetch
  if (provider === 'anthropic') {
    try {
      const client = new Anthropic({ apiKey: key, fetch: doFetch, maxRetries: 0, timeout: 15_000 })
      await client.models.list({ limit: 1 })
      return { ok: true }
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
        return { ok: false, reason: 'rejected', status: error.status }
      }
      return { ok: false, reason: 'unreachable', status: error instanceof Anthropic.APIError ? error.status : undefined }
    }
  }
  try {
    const res = await doFetch(`${OPENAI_COMPATIBLE_BASE[provider]}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (res.ok) return { ok: true }
    if (res.status === 401 || res.status === 403) return { ok: false, reason: 'rejected', status: res.status }
    return { ok: false, reason: 'unreachable', status: res.status }
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
}

export type CompletionRequest = {
  model?: string
  system: string
  user: string
  /** JSON Schema the reply must satisfy (strict structured output). */
  schema: Record<string, unknown>
  schemaName: string
  maxTokens: number
}

export type Completion = { json: unknown; inputTokens: number; outputTokens: number; model: string }

export class ProviderError extends Error {
  constructor(public kind: 'rejected_key' | 'rate_limited' | 'refused' | 'bad_output' | 'upstream', message: string, public status?: number) {
    super(message)
  }
}

/** A single structured-output call. Callers keep their own grounding checks on the result. */
export async function complete(provider: ProviderId, key: string, req: CompletionRequest, deps: Deps = {}): Promise<Completion> {
  const model = req.model ?? PROVIDERS[provider].defaultModel
  const doFetch = deps.fetch ?? fetch

  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey: key, fetch: doFetch, maxRetries: 2, timeout: 120_000 })
    try {
      const msg = await client.messages.create({
        model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
        output_config: { format: { type: 'json_schema', schema: req.schema } },
      })
      if (msg.stop_reason === 'refusal') throw new ProviderError('refused', 'The model declined to answer.')
      if (msg.stop_reason === 'max_tokens') throw new ProviderError('bad_output', 'The answer was cut off at the token limit.')
      const text = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
      return { json: parseJson(text), inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens, model }
    } catch (error) {
      if (error instanceof ProviderError) throw error
      if (error instanceof Anthropic.AuthenticationError) throw new ProviderError('rejected_key', 'The Anthropic key was rejected.', 401)
      if (error instanceof Anthropic.RateLimitError) throw new ProviderError('rate_limited', 'Anthropic rate limit reached.', 429)
      if (error instanceof Anthropic.APIError) throw new ProviderError('upstream', `Anthropic error ${error.status}`, error.status)
      throw new ProviderError('upstream', 'Anthropic is unreachable.')
    }
  }

  const res = await doFetch(`${OPENAI_COMPATIBLE_BASE[provider]}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.user }],
      response_format: { type: 'json_schema', json_schema: { name: req.schemaName, strict: true, schema: req.schema } },
      max_completion_tokens: req.maxTokens,
    }),
    signal: AbortSignal.timeout(120_000),
  }).catch(() => {
    throw new ProviderError('upstream', `${PROVIDERS[provider].label} is unreachable.`)
  })
  if (res.status === 401 || res.status === 403) throw new ProviderError('rejected_key', `The ${PROVIDERS[provider].label} key was rejected.`, res.status)
  if (res.status === 429) throw new ProviderError('rate_limited', `${PROVIDERS[provider].label} rate limit reached.`, 429)
  if (!res.ok) throw new ProviderError('upstream', `${PROVIDERS[provider].label} error ${res.status}`, res.status)
  const body = (await res.json()) as {
    choices?: { message?: { content?: string; refusal?: string | null }; finish_reason?: string }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const choice = body.choices?.[0]
  if (choice?.message?.refusal) throw new ProviderError('refused', 'The model declined to answer.')
  if (choice?.finish_reason === 'length') throw new ProviderError('bad_output', 'The answer was cut off at the token limit.')
  return {
    json: parseJson(choice?.message?.content ?? ''),
    inputTokens: body.usage?.prompt_tokens ?? 0,
    outputTokens: body.usage?.completion_tokens ?? 0,
    model,
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new ProviderError('bad_output', 'The model did not return valid JSON.')
  }
}
