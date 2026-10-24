// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { complete, keyShapeError, ProviderError, verifyKey } from '../lib/server/ai/providers'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('keyShapeError', () => {
  it('accepts plausible keys and rejects junk', () => {
    expect(keyShapeError('gsk_abcdefghijklmnopqrstuvwxyz')).toBeNull()
    expect(keyShapeError('  gsk_abcdefghijklmnopqrstuvwxyz  ')).toBeNull()
    expect(keyShapeError('short')).not.toBeNull()
    expect(keyShapeError('has space inside the key 123')).not.toBeNull()
    expect(keyShapeError(undefined)).not.toBeNull()
  })
})

describe('verifyKey', () => {
  it('lists models on OpenAI-compatible providers with a bearer key', async () => {
    const fetch = vi.fn(async () => json(200, { data: [] }))
    expect(await verifyKey('groq', 'gsk_test_key_123456789', { fetch })).toEqual({ ok: true })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.groq.com/openai/v1/models')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer gsk_test_key_123456789')
  })

  it('distinguishes a rejected key from an outage', async () => {
    expect(await verifyKey('openai', 'sk-test-key-1234567890', { fetch: async () => json(401, {}) })).toMatchObject({ ok: false, reason: 'rejected' })
    expect(await verifyKey('openai', 'sk-test-key-1234567890', { fetch: async () => json(503, {}) })).toMatchObject({ ok: false, reason: 'unreachable' })
    expect(await verifyKey('groq', 'gsk_test_key_123456789', { fetch: async () => { throw new TypeError('network') } })).toMatchObject({ ok: false, reason: 'unreachable' })
  })

  it('uses the Anthropic SDK and maps authentication errors to rejected', async () => {
    const ok = vi.fn(async () => json(200, { data: [], has_more: false, first_id: null, last_id: null }))
    expect(await verifyKey('anthropic', 'sk-ant-test-key-123456', { fetch: ok })).toEqual({ ok: true })
    expect(String((ok.mock.calls[0] as unknown[])[0])).toContain('/v1/models')
    const bad = async () => json(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } })
    expect(await verifyKey('anthropic', 'sk-ant-test-key-123456', { fetch: bad })).toMatchObject({ ok: false, reason: 'rejected' })
  })
})

describe('complete', () => {
  const req = { system: 'sys', user: 'q', schema: { type: 'object' }, schemaName: 'answer', maxTokens: 500 }

  it('sends strict JSON-schema output on OpenAI-compatible providers', async () => {
    const fetch = vi.fn(async () => json(200, {
      choices: [{ message: { content: '{"a":1}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 12, completion_tokens: 3 },
    }))
    const out = await complete('groq', 'gsk_test_key_123456789', req, { fetch })
    expect(out).toEqual({ json: { a: 1 }, inputTokens: 12, outputTokens: 3, model: 'openai/gpt-oss-120b' })
    const sent = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(sent.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'answer', strict: true, schema: { type: 'object' } } })
  })

  it('uses output_config.format on Anthropic and reports token usage', async () => {
    const fetch = vi.fn(async () => json(200, {
      id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null,
      content: [{ type: 'text', text: '{"a":2}' }], usage: { input_tokens: 20, output_tokens: 4 },
    }))
    const out = await complete('anthropic', 'sk-ant-test-key-123456', req, { fetch })
    expect(out).toMatchObject({ json: { a: 2 }, inputTokens: 20, outputTokens: 4, model: 'claude-opus-5-5' })
    const sent = JSON.parse(((fetch.mock.calls[0] as unknown[])[1] as RequestInit).body as string)
    expect(sent.output_config).toEqual({ format: { type: 'json_schema', schema: { type: 'object' } } })
  })

  it('raises typed errors for rejected keys, truncation and bad JSON', async () => {
    await expect(complete('openai', 'sk-test-key-1234567890', req, { fetch: async () => json(401, {}) })).rejects.toMatchObject({ kind: 'rejected_key' })
    await expect(complete('groq', 'gsk_test_key_123456789', req, {
      fetch: async () => json(200, { choices: [{ message: { content: '{"a"' }, finish_reason: 'length' }] }),
    })).rejects.toMatchObject({ kind: 'bad_output' })
    await expect(complete('groq', 'gsk_test_key_123456789', req, {
      fetch: async () => json(200, { choices: [{ message: { content: 'not json' }, finish_reason: 'stop' }] }),
    })).rejects.toBeInstanceOf(ProviderError)
  })
})
