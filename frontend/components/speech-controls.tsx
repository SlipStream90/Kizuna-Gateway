'use client'

import { useState, useRef, useCallback, useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import { api } from '../lib/api'
import { useI18n } from '../lib/i18n'

type Status = 'idle' | 'recording' | 'processing'

/**
 * Speech-to-speech translation. Captures microphone audio via the MediaRecorder
 * API, base64-encodes the WAV blob, and posts it through the same-origin BFF
 * proxy (app/api/v1/speech/translate), which attaches the bearer token from the
 * sealed session server-side — no token or raw audio reaches client logic
 * beyond the recorder itself.
 */
export function SpeechControls() {
  const { t } = useI18n()
  const [status, setStatus] = useState<Status>('idle')
  const [transcript, setTranscript] = useState<string | null>(null)
  const [translated, setTranslated] = useState<string | null>(null)
  const [provider, setProvider] = useState<string | null>(null)
  const [fallback, setFallback] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    setError(null)
    setTranscript(null)
    setTranslated(null)
    setProvider(null)
    setFallback(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunks.current = []
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        setStatus('processing')
        void processAudio(new Blob(chunks.current, { type: 'audio/webm' }))
      }
      mediaRecorder.current = recorder
      recorder.start(200)
      setStatus('recording')
    } catch (unknown) {
      setError(unknown instanceof Error ? unknown.message : 'Microphone access failed.')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && status === 'recording') {
      mediaRecorder.current.stop()
      mediaRecorder.current = null
    }
  }, [status])

  // Read on the client only; the server snapshot assumes support so hydration matches.
  const isSupported = useSyncExternalStore(
    () => () => undefined,
    () => typeof MediaRecorder !== 'undefined',
    () => true,
  )

  async function processAudio(blob: Blob) {
    try {
      const arrayBuffer = await blob.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      const audioBase64 = btoa(binary)

      const body = await api<{
        transcript: string
        translated_text: string
        provider: string
        endpoint: string | null
        deterministic_fallback: boolean
      }>('/speech/translate', {
        method: 'POST',
        body: JSON.stringify({
          audio_base64: audioBase64,
          source_lang: 'ja',
          target_lang: 'en',
        }),
      })
      setTranscript(body.transcript)
      setTranslated(body.translated_text)
      setProvider(body.provider)
      setFallback(body.deterministic_fallback)
    } catch (unknown) {
      setError(unknown instanceof Error ? unknown.message : 'Speech translation failed.')
    } finally {
      setStatus('idle')
    }
  }

  const label = status === 'recording' ? t('sp.stop') : status === 'processing' ? t('sp.loading') : t('sp.record')

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div className="space-y-4">
        <p className="text-sm text-sumi/60">
          {t('sp.intro')}
        </p>
        {!isSupported && (
          <p className="text-sm text-akaneiro bg-akaneiro/10 rounded-lg p-3 border border-akaneiro/30">
            MediaRecorder is not supported in this browser.
          </p>
        )}
        <button
          disabled={!isSupported || status === 'processing'}
          onClick={status === 'recording' ? stopRecording : startRecording}
          className={`glass-button w-full py-3 text-sm font-semibold disabled:opacity-60 ${
            status === 'recording' ? 'border-akaneiro bg-akaneiro/20 text-akaneiro' : ''
          }`}
        >
          {label}
        </button>
        {error && (
          <p className="text-sm text-akaneiro bg-akaneiro/10 rounded-lg p-3 border border-akaneiro/30">
            {error}
          </p>
        )}
        {transcript !== null && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-sumi">{t('sp.transcript')}</h3>
            <p className="text-sm text-sumi break-words rounded-lg bg-sakura/40 p-3 border border-aijiro/30">
              {transcript}
            </p>
            <h3 className="text-sm font-bold text-sumi">{t('sp.translation')}</h3>
            <p className="text-sm text-sumi break-words rounded-lg bg-washi/50 p-3 border border-hairline">
              {translated}
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
