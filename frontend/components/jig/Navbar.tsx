'use client'

import { motion } from 'motion/react'
import { FileSignature, Grid3x3, Handshake, Network, ScrollText } from 'lucide-react'
import { LanguageToggle } from '../../lib/i18n'
import { useL } from '../../lib/jig/useL'
import { cn } from '../../lib/utils'

export type ScreenId = 'matrix' | 'ringi' | 'evidence' | 'ask' | 'partners'

const TABS: { id: ScreenId; icon: typeof Grid3x3; label: { en: string; ja: string }; num: string }[] = [
  { id: 'matrix', icon: Grid3x3, num: '01', label: { en: 'State & Policy Matrix', ja: '州・政策比較' } },
  { id: 'ringi', icon: FileSignature, num: '02', label: { en: 'Ringi-sho & Nemawashi', ja: '稟議書・根回し' } },
  { id: 'evidence', icon: Network, num: '03', label: { en: 'Evidence & Audit Trail', ja: '証拠・監査証跡' } },
  { id: 'ask', icon: ScrollText, num: '04', label: { en: 'Ask the Statutes', ja: '法令照会' } },
  { id: 'partners', icon: Handshake, num: '05', label: { en: 'Partner Trust', ja: 'パートナー信頼性' } },
]

export function Navbar({ screen, onScreen }: { screen: ScreenId; onScreen: (s: ScreenId) => void }) {
  const { L, lang } = useL()
  return (
    <header className="sticky top-0 z-40 border-b border-black/40 bg-sumi text-white">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 md:px-6">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80" title={lang === 'ja' ? 'Nishi Link トップへ' : 'Back to Nishi Link'}>
            <span className="hanko h-8 w-8 text-base" aria-hidden>西</span>
            <span className="jp-heading hidden text-sm text-white/80 sm:inline">Nishi Link</span>
          </a>
          <span className="h-6 w-px bg-white/20" aria-hidden />
          <a href="/jig-os" className="leading-tight">
            <span className="block font-mono text-sm font-semibold tracking-wider">JIG-OS</span>
            <span className="block text-[10px] text-white/55">
              {lang === 'ja' ? '日印ゲートウェイOS · モジュール2 稟議フロー' : 'Japan-India Gateway OS · Module 2 Ringi-Flow'}
            </span>
          </a>
        </div>

        <nav aria-label={lang === 'ja' ? '画面' : 'Screens'} className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
          {TABS.map((tab) => {
            const active = screen === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onScreen(tab.id)}
                className={cn(
                  'relative flex shrink-0 items-center gap-1.5 px-2.5 py-2 text-xs transition-colors',
                  active ? 'text-white' : 'text-white/55 hover:text-white',
                )}
              >
                <span className="font-mono text-[10px] text-white/40">{tab.num}</span>
                <tab.icon className="size-3.5" aria-hidden />
                {L(tab.label)}
                {active && (
                  <motion.span layoutId="jig-tab" className="absolute inset-x-2 -bottom-[11px] h-[2px] bg-akaneiro" />
                )}
              </button>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 font-mono text-[10px] text-white/50 2xl:flex">
            <span className="size-1.5 rounded-full bg-bamboo" aria-hidden />
            {lang === 'ja' ? 'デモデータ · ローカル実行' : 'Demo data · runs locally'}
          </span>
          <LanguageToggle tone="dark" />
        </div>
      </div>
    </header>
  )
}
