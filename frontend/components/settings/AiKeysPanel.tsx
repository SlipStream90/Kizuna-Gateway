'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, ExternalLink, KeyRound, Loader2, LogOut, ShieldCheck, Trash2, XCircle } from 'lucide-react'

import { LanguageToggle, useI18n } from '../../lib/i18n'
import { cn } from '../../lib/utils'

type Provider = {
  id: 'groq' | 'anthropic' | 'openai'
  label: string
  default_model: string
  key_prefix: string
  console_url: string
  configured: boolean
  key_hint: string | null
  key_label: string | null
  updated_at: string | null
}
type KeysResponse = { workspace: { name: string; role: string; can_manage: boolean }; providers: Provider[] }
// Messages keep both languages so they follow the toggle; server details are English only.
type Status = { kind: 'ok' | 'error'; text: { en: string; ja: string } } | null

const USES = {
  en: 'Used for statute answers, Ringi-sho wording and GTM simulations. Calls are billed to your provider account.',
  ja: '法令照会の回答、稟議書の文案、GTMシミュレーションに使用します。利用料金はご自身のプロバイダー契約に請求されます。',
}

export function AiKeysPanel() {
  const { lang } = useI18n()
  const ja = lang === 'ja'
  const [data, setData] = useState<KeysResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/v1/ai-keys', { cache: 'no-store' })
    if (res.status === 401) return window.location.assign('/login?next=%2Fsettings%2Fai-keys')
    if (!res.ok) return setLoadError(ja ? 'キー情報を読み込めませんでした。' : 'Could not load your keys.')
    setData(await res.json())
  }
  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-washi">
      <header className="border-b border-white/10 bg-sumi text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          <a href="/jig-os" className="inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white">
            <ArrowLeft className="size-3.5" aria-hidden />JIG-OS
          </a>
          <div className="ml-auto flex items-center gap-3">
            <form action="/auth/signout" method="post">
              <button type="submit" className="inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white">
                <LogOut className="size-3.5" aria-hidden />{ja ? 'ログアウト' : 'Sign out'}
              </button>
            </form>
            <LanguageToggle tone="dark" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-sumi/50">
            {ja ? '設定' : 'Settings'}{data ? ` · ${data.workspace.name}` : ''}
          </p>
          <h1 className="jp-heading mt-1 text-2xl text-sumi md:text-3xl">{ja ? 'AIプロバイダーのキー' : 'AI provider keys'}</h1>
          <p className="mt-2 max-w-2xl text-sm text-sumi/65">{ja ? USES.ja : USES.en}</p>
        </div>

        <p className="flex items-start gap-2 border border-hairline bg-white px-3 py-2 text-xs text-sumi/70">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-bamboo" aria-hidden />
          {ja
            ? 'キーはSupabase Vaultで暗号化して保存され、サーバー側でのみ使用されます。保存後は末尾4文字だけが表示され、ブラウザに送り返されることはありません。'
            : 'Keys are encrypted in Supabase Vault and only used server-side. After saving, only the last four characters are shown; the key is never sent back to the browser.'}
        </p>

        {data && !data.workspace.can_manage && (
          <p className="border border-dashed border-gold/60 bg-gold/5 px-3 py-2 text-xs text-[#6b5628]">
            {ja ? 'キーの追加・削除はワークスペース管理者のみ可能です。' : 'Only workspace admins can add or remove keys.'}
          </p>
        )}
        {loadError && <p role="alert" className="text-sm text-akaneiro">{loadError}</p>}
        {!data && !loadError && (
          <p className="flex items-center gap-2 text-xs text-sumi/50"><Loader2 className="size-4 animate-spin" aria-hidden />{ja ? '読み込み中…' : 'Loading…'}</p>
        )}

        <ul className="space-y-3">
          {data?.providers.map((p) => (
            <ProviderCard key={p.id} p={p} canManage={data.workspace.can_manage} onChange={load} />
          ))}
        </ul>
      </main>
    </div>
  )
}

function ProviderCard({ p, canManage, onChange }: { p: Provider; canManage: boolean; onChange: () => Promise<void> }) {
  const { lang } = useI18n()
  const ja = lang === 'ja'
  const [editing, setEditing] = useState(false)
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState<'save' | 'test' | 'delete' | null>(null)
  const [status, setStatus] = useState<Status>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy('save')
    setStatus(null)
    const res = await fetch(`/api/v1/ai-keys/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, label }),
    })
    const body = res.status === 204 ? null : await res.json().catch(() => null)
    setBusy(null)
    if (!res.ok) return setStatus({ kind: 'error', text: body?.detail ? { en: body.detail, ja: body.detail } : { en: 'Could not save the key.', ja: '保存できませんでした。' } })
    setKey('')
    setLabel('')
    setEditing(false)
    setStatus({ kind: 'ok', text: { en: 'Key verified and saved.', ja: 'キーを確認して保存しました。' } })
    await onChange()
  }

  async function test() {
    setBusy('test')
    setStatus(null)
    const res = await fetch(`/api/v1/ai-keys/${p.id}/test`, { method: 'POST' })
    const body = await res.json().catch(() => null)
    setBusy(null)
    setStatus(
      res.ok && body?.ok
        ? { kind: 'ok', text: { en: 'The key works.', ja: 'キーは有効です。' } }
        : { kind: 'error', text: body?.detail ? { en: body.detail, ja: body.detail } : { en: 'Could not check the key.', ja: '確認できませんでした。' } },
    )
  }

  async function remove() {
    if (!window.confirm(ja ? `${p.label}のキーを削除しますか？` : `Remove the ${p.label} key?`)) return
    setBusy('delete')
    setStatus(null)
    const res = await fetch(`/api/v1/ai-keys/${p.id}`, { method: 'DELETE' })
    setBusy(null)
    if (!res.ok) return setStatus({ kind: 'error', text: { en: 'Could not remove the key.', ja: '削除できませんでした。' } })
    await onChange()
  }

  const updated = p.updated_at ? new Date(p.updated_at).toLocaleDateString(ja ? 'ja-JP' : 'en-GB', { dateStyle: 'medium' }) : null

  return (
    <li className="border border-hairline bg-white" aria-label={p.label}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <KeyRound className={cn('size-4', p.configured ? 'text-bamboo' : 'text-sumi/30')} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-sumi">{p.label}</p>
          <p className="font-mono text-[11px] text-sumi/50">
            {p.configured
              ? `${p.key_prefix}••••${p.key_hint}${p.key_label ? ` · ${p.key_label}` : ''}${updated ? ` · ${ja ? '更新' : 'updated'} ${updated}` : ''}`
              : ja ? '未設定' : 'Not set'}
            {' · '}{ja ? '既定モデル' : 'default model'} {p.default_model}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {p.configured && (
            <button type="button" onClick={test} disabled={busy !== null} className="border border-hairline px-2.5 py-1 text-xs text-sumi/80 hover:border-sumi disabled:opacity-50">
              {busy === 'test' ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : ja ? 'テスト' : 'Test'}
            </button>
          )}
          {canManage && !editing && (
            <button type="button" onClick={() => { setEditing(true); setStatus(null) }} className="border border-sumi bg-sumi px-2.5 py-1 text-xs text-white hover:bg-sumi/90">
              {p.configured ? (ja ? '置き換え' : 'Replace') : ja ? 'キーを追加' : 'Add key'}
            </button>
          )}
          {canManage && p.configured && (
            <button type="button" onClick={remove} disabled={busy !== null} aria-label={ja ? '削除' : 'Remove'} className="border border-hairline p-1.5 text-sumi/60 hover:border-akaneiro hover:text-akaneiro disabled:opacity-50">
              {busy === 'delete' ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Trash2 className="size-3.5" aria-hidden />}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <form onSubmit={save} className="space-y-2 border-t border-hairline bg-washi/40 px-4 py-3">
          <label className="block text-xs text-sumi/70">
            {ja ? `${p.label}のAPIキー` : `${p.label} API key`}
            <input
              type="password" required autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)}
              placeholder={`${p.key_prefix}…`}
              className="mt-1 w-full border border-hairline bg-white px-2.5 py-2 font-mono text-sm text-sumi outline-none focus:border-sumi"
            />
          </label>
          <label className="block text-xs text-sumi/70">
            {ja ? 'ラベル（任意）' : 'Label (optional)'}
            <input
              type="text" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder={ja ? '例：本番用' : 'e.g. Production'}
              className="mt-1 w-full border border-hairline bg-white px-2.5 py-2 text-sm text-sumi outline-none focus:border-sumi"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="submit" disabled={busy !== null} className="glass-button px-3 py-1.5 text-xs disabled:opacity-60">
              {busy === 'save' && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {ja ? '確認して保存' : 'Verify & save'}
            </button>
            <button type="button" onClick={() => { setEditing(false); setKey(''); setLabel('') }} className="px-2 py-1.5 text-xs text-sumi/60 hover:text-sumi">
              {ja ? 'キャンセル' : 'Cancel'}
            </button>
            <a href={p.console_url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-aijiro hover:underline">
              {ja ? 'キーを取得' : 'Get a key'}<ExternalLink className="size-3" aria-hidden />
            </a>
          </div>
          <p className="text-[11px] text-sumi/50">
            {ja ? '保存前にプロバイダーへモデル一覧を問い合わせてキーを確認します（トークンは消費しません）。' : 'Before saving, the key is checked by listing the provider’s models (no tokens are spent).'}
          </p>
        </form>
      )}

      {status && (
        <p role={status.kind === 'error' ? 'alert' : 'status'} className={cn('flex items-center gap-1.5 border-t border-hairline px-4 py-2 text-xs', status.kind === 'ok' ? 'text-bamboo' : 'text-akaneiro')}>
          {status.kind === 'ok' ? <CheckCircle2 className="size-3.5" aria-hidden /> : <XCircle className="size-3.5" aria-hidden />}
          {status.text[lang]}
        </p>
      )}
    </li>
  )
}
