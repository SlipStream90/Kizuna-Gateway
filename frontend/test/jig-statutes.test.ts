import { afterEach, describe, expect, it, vi } from 'vitest'
import { askStatutes, ringiQuestion, StatuteError } from '../lib/jig/statutes'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => vi.unstubAllGlobals())

describe('askStatutes', () => {
  it('posts to the BFF answer endpoint and returns the payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { status: 'answered', answer: [], sources: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await askStatutes({ query: 'FC-GPR deadline', lang: 'en', k: 6 })
    expect(res.status).toBe('answered')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/compliance/answer')
    expect(JSON.parse(init.body)).toEqual({ query: 'FC-GPR deadline', lang: 'en', k: 6 })
  })

  it.each([
    [() => Promise.resolve(json(401, {})), 'signed_out'],
    [() => Promise.resolve(json(503, { detail: 'sentence-transformers is not installed' })), 'unavailable'],
    [() => Promise.resolve(new Response('', { status: 500 })), 'offline'],
    [() => Promise.reject(new TypeError('Failed to fetch')), 'offline'],
  ])('classifies failures (%#)', async (impl, kind) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(impl))
    const error = await askStatutes({ query: 'x', lang: 'en' }).catch((e) => e)
    expect(error).toBeInstanceOf(StatuteError)
    expect(error.kind).toBe(kind)
  })

  it('lets aborts propagate untouched', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort))
    await expect(askStatutes({ query: 'x', lang: 'ja' })).rejects.toBe(abort)
  })
})

describe('ringiQuestion', () => {
  it('asks in the document language about the proposal specifics', () => {
    expect(ringiQuestion('en', 'Auto Components', 'Sri City, Andhra Pradesh')).toContain('Auto Components manufacturing subsidiary in Sri City')
    expect(ringiQuestion('ja', '自動車部品', 'スリシティ')).toContain('スリシティで自動車部品の製造子会社')
  })
})
