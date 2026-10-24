// Optional LLM pass: polishes the wording of a template-generated Ringi-sho.
// The template stays the source of truth — figures, names, gate thresholds and
// citations must survive unchanged, and the response is rejected if they don't.

import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

type Lang = 'en' | 'ja'
type Sections = { overview: string; capital: string; exitGates: string }
const KEYS = ['overview', 'capital', 'exitGates'] as const

const configured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)

export async function GET() {
  return Response.json({ configured: configured() })
}

const SCHEMA = {
  type: 'object',
  properties: { overview: { type: 'string' }, capital: { type: 'string' }, exitGates: { type: 'string' } },
  required: [...KEYS],
  additionalProperties: false,
}

const SYSTEM: Record<Lang, string> = {
  ja: [
    'あなたは日本企業の経営企画部に所属し、取締役会に提出する稟議書を推敲する担当者です。',
    '入力はJSON形式の稟議書3節（案件概要・投資金額・撤退基準）です。各節の文章を、取締役会向けの格調ある敬語（です・ます調、謙譲語を適切に使用）に整えてください。',
    '厳守事項：数値・金額・割合・期間・社名・地名・法令名は一字一句変えないこと。新たな事実・数値・根拠を加えないこと。箇条書きの番号と構成、改行は維持すること。',
  ].join('\n'),
  en: [
    'You edit board papers for a Japanese corporation. The input is three sections of a Ringi-sho (approval proposal) as JSON: overview, capital commitment, exit-gate criteria.',
    'Rewrite each section in formal, concise board-paper English suitable for a Japanese headquarters audience.',
    'Hard rules: keep every number, amount, percentage, duration, company name, place name and statute name exactly as written. Add no new facts, figures or sources. Keep list numbering, structure and line breaks.',
  ].join('\n'),
}

/** Every numeric token in the original must still appear in the refinement. */
function figuresPreserved(original: Sections, refined: Sections) {
  const nums = (s: string) => s.match(/\d[\d,.]*/g) ?? []
  return KEYS.every((k) => nums(original[k]).every((n) => refined[k].includes(n)))
}

function parseBody(body: unknown): { lang: Lang; sections: Sections } | null {
  if (!body || typeof body !== 'object') return null
  const { lang, sections } = body as { lang?: unknown; sections?: Record<string, unknown> }
  if (lang !== 'en' && lang !== 'ja') return null
  if (!sections || !KEYS.every((k) => typeof sections[k] === 'string' && (sections[k] as string).length < 8000)) return null
  return { lang, sections: { overview: sections.overview as string, capital: sections.capital as string, exitGates: sections.exitGates as string } }
}

export async function POST(request: Request) {
  if (!configured()) {
    return Response.json({ error: 'Claude is not configured. Set ANTHROPIC_API_KEY in frontend/.env.local and restart the dev server.' }, { status: 503 })
  }
  const input = parseBody(await request.json().catch(() => null))
  if (!input) return Response.json({ error: 'Invalid request body.' }, { status: 400 })

  const client = new Anthropic()
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // Re-run on Anthropic's recommended fallback model if a safety classifier declines.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM[input.lang],
      messages: [{ role: 'user', content: JSON.stringify(input.sections) }],
    })

    if (response.stop_reason === 'refusal') {
      return Response.json({ error: 'The model declined this request; the template draft is unchanged.' }, { status: 422 })
    }
    if (response.stop_reason === 'max_tokens') {
      return Response.json({ error: 'The refinement was cut off; the template draft is unchanged.' }, { status: 502 })
    }

    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    let refined: Sections
    try {
      refined = JSON.parse(text)
    } catch {
      return Response.json({ error: 'The model returned malformed output; the template draft is unchanged.' }, { status: 502 })
    }
    if (!KEYS.every((k) => typeof refined[k] === 'string' && refined[k].trim())) {
      return Response.json({ error: 'The model returned incomplete sections; the template draft is unchanged.' }, { status: 502 })
    }
    if (!figuresPreserved(input.sections, refined)) {
      return Response.json({ error: 'The refinement altered figures, so it was discarded; the template draft is unchanged.' }, { status: 422 })
    }
    return Response.json({ sections: refined, model: response.model })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: 'Anthropic API key was rejected.' }, { status: 401 })
    }
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: 'Rate limited by the Anthropic API — try again shortly.' }, { status: 429 })
    }
    if (error instanceof Anthropic.BadRequestError) {
      return Response.json({ error: `Request rejected: ${error.message}` }, { status: 400 })
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json({ error: `Anthropic API error ${error.status ?? ''}`.trim() }, { status: 502 })
    }
    return Response.json({ error: 'Could not reach the Anthropic API.' }, { status: 502 })
  }
}
