'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../lib/api'

type Language = { code: string; label: string }

const LANGUAGES: Language[] = [
  { code: 'ja', label: 'Japanese' },
  { code: 'en', label: 'English' },
]

/**
 * Japanese <-> English translation. The request goes through the same-origin
 * BFF proxy (app/api/v1/translate), which attaches the bearer token from the
 * sealed session server-side — no token reaches client JavaScript.
 */
export function TranslationControls() {
  const [text, setText] = useState('')
  const [sourceLang, setSourceLang] = useState('ja')
  const [targetLang, setTargetLang] = useState('en')
  const [result, setResult] = useState<string | null>(null)
  const [provider, setProvider] = useState<string | null>(null)
  const [fallback, setFallback] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function translate() {
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const body = await api<{
        translated_text: string
        provider: string
        deterministic_fallback: boolean
      }>('/translate', {
        method: 'POST',
        body: JSON.stringify({
          text,
          source_lang: sourceLang,
          target_lang: targetLang,
        }),
      })
      setResult(body.translated_text)
      setProvider(body.provider)
      setFallback(body.deterministic_fallback)
    } catch (unknown) {
      setError(unknown instanceof Error ? unknown.message : 'Translation failed.')
    } finally {
      setLoading(false)
    }
  }

  function swap() {
    setResult(null)
    setFallback(null)
    setProvider(null)
    setError(null)
    setSourceLang(sourceLang === 'ja' ? 'en' : 'ja')
    setTargetLang(targetLang === 'en' ? 'ja' : 'en')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <h2 className="text-lg font-bold text-sumi">Japanese ↔ English translation</h2>
      <div className="glass-panel p-5 rounded-xl space-y-4">
        <div className="flex items-center gap-3">
          <select
            aria-label="Source language"
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            className="glass-input px-3 py-1.5 text-sm rounded-lg"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
          <button
            aria-label="Swap languages"
            onClick={swap}
            className="px-3 py-1.5 rounded-lg bg-white/40 border border-white/40 text-sumi/70 hover:bg-white/60 transition-colors"
          >
            ↷
          </button>
          <select
            aria-label="Target language"
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="glass-input px-3 py-1.5 text-sm rounded-lg"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          aria-label="Text to translate"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter Japanese or English text…"
          className="glass-input w-full min-h-[120px] px-3 py-2.5 text-sm rounded-lg resize-none"
          rows={4}
        />
        <button
          disabled={loading || !text.trim()}
          onClick={translate}
          className="glass-button w-full py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? 'Translating…' : 'Translate'}
        </button>
        {error && (
          <p className="text-sm text-akaneiro bg-akaneiro/10 rounded-lg p-3 border border-akaneiro/30">
            {error}
          </p>
        )}
        {result !== null && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-sumi">Translation</h3>
            <p className="text-sm text-sumi break-words rounded-lg bg-washi/50 p-3 border border-white/40">
              {result}
            </p>
            <p className="text-xs text-sumi/50">
              Provider: {provider}{' '}
              {fallback ? '(deterministic illustrative fallback — not verified content)' : ''}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
