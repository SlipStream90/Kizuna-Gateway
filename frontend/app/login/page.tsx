'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { KeyRound, Loader2, Mail } from 'lucide-react'

import { useI18n } from '../../lib/i18n'
import { createClient } from '../../lib/supabase/client'

/** Only same-site paths, so a crafted ?next= cannot bounce users off-site. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/jig-os'
}

function LoginForm() {
  const { lang } = useI18n()
  const ja = lang === 'ja'
  const router = useRouter()
  const next = safeNext(useSearchParams().get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'link' | 'password'>('link')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    const supabase = createClient()
    if (mode === 'password') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setBusy(false)
      if (error) return setMessage({ kind: 'error', text: ja ? 'メールアドレスまたはパスワードが正しくありません。' : error.message })
      router.replace(next)
      router.refresh()
      return
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    setBusy(false)
    setMessage(
      error
        ? { kind: 'error', text: error.message }
        : { kind: 'ok', text: ja ? 'ログイン用リンクを送信しました。メールを確認してください。' : 'Check your email for a sign-in link.' },
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-washi px-4">
      <form onSubmit={submit} className="w-full max-w-sm border border-hairline bg-white p-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-sumi/50">Nishi Link · JIG-OS</p>
        <h1 className="jp-heading mt-1 text-2xl text-sumi">{ja ? 'ログイン' : 'Sign in'}</h1>
        <p className="mt-1 text-xs text-sumi/60">
          {ja ? '新しいアカウントには自動でワークスペースが作成されます。' : 'New accounts get their own workspace automatically.'}
        </p>

        <div role="tablist" className="mt-5 grid grid-cols-2 border border-hairline text-xs">
          {(['link', 'password'] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
              className={mode === m ? 'bg-sumi py-1.5 text-white' : 'py-1.5 text-sumi/70 hover:bg-washi'}>
              {m === 'link' ? (ja ? 'メールリンク' : 'Email link') : (ja ? 'パスワード' : 'Password')}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-xs text-sumi/70">
          {ja ? 'メールアドレス' : 'Email'}
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-hairline px-2.5 py-2 text-sm text-sumi outline-none focus:border-sumi" />
        </label>
        {mode === 'password' && (
          <label className="mt-3 block text-xs text-sumi/70">
            {ja ? 'パスワード' : 'Password'}
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border border-hairline px-2.5 py-2 text-sm text-sumi outline-none focus:border-sumi" />
          </label>
        )}

        <button type="submit" disabled={busy} className="glass-button mt-5 w-full justify-center px-4 py-2 text-sm disabled:opacity-60">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : mode === 'link' ? <Mail className="size-4" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
          {mode === 'link' ? (ja ? 'リンクを送信' : 'Send sign-in link') : (ja ? 'ログイン' : 'Sign in')}
        </button>

        {message && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className={`mt-3 text-xs ${message.kind === 'error' ? 'text-akaneiro' : 'text-bamboo'}`}>
            {message.text}
          </p>
        )}
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
