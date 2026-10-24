'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type Lang = 'en' | 'ja'

const STORAGE_KEY = 'nishi-lang'

const dictionary = {
  en: {
    'nav.engines': 'Engines',
    'nav.assessment': 'Assessment',
    'nav.translation': 'Translation',
    'nav.speech': 'Speech',
    'lang.label': 'Language',

    'hero.eyebrow': 'Market entry decision support · Japan → India',
    'hero.line1': 'Enter India',
    'hero.line2Prefix': 'with ',
    'hero.highlight': 'clarity',
    'hero.rotate1': 'clarity',
    'hero.rotate2': 'evidence',
    'hero.rotate3': 'confidence',
    'hero.fanLabel': 'Scenes from Japan and India',

    'band.eyebrow': 'By design',
    'band.title': 'Built to be checked,',
    'band.titleAccent': 'not taken on faith.',
    'band.body': 'Every number on the platform shows where it came from and what it assumes.',
    'band.engines': 'Connected engines',
    'band.languages': 'Languages',
    'band.routes': 'Entry routes compared',
    'band.assumptions': 'Of outputs state their assumptions',
    'band.cta': 'See the evidence in JIG-OS',

    'nav.jigos': 'JIG-OS',
    'nav.preview': 'Preview',
    'hero.jigos': 'Open JIG-OS',
    'hero.fanJapan': 'Japan',
    'hero.fanIndia': 'India',

    'preview.title': 'Preview a Ringi-sho before you sign in',
    'preview.body':
      'Pick a Japan Industrial Township and sector. See how ready each headquarters department is to approve, and the statute behind every answer.',
    'preview.state': 'Township',
    'preview.sector': 'Sector',
    'preview.readiness': 'Department readiness',
    'preview.objections': 'First questions HQ will ask',
    'preview.friction': 'Friction index',
    'preview.frictionHint': 'lower is better',
    'preview.cta': 'Draft the full Ringi-sho in JIG-OS',
    'preview.note': 'Runs in your browser. Demo figures are labelled; cited clauses must be verified.',

    'tour.open': 'Open in JIG-OS',
    'form.offline': "The assessment service didn't respond as expected. You can still draft a Ringi-sho from these inputs in JIG-OS, which runs offline.",
    'form.offlineCta': 'Continue in JIG-OS',
    'workflow.handoff': 'Draft the Ringi-sho for this assessment in JIG-OS',
    'hero.line2Suffix': '.',
    'hero.body':
      'A decision-support workspace for Japanese SMEs weighing expansion into India — regions, partners, compliance and go-to-market cost, each with its sources and assumptions in plain view.',
    'hero.primary': 'Start assessment',
    'hero.secondary': 'How it works',

    'features.title': 'Four connected engines',
    'features.body': 'Each engine produces traceable output with explicit assumptions and limitations.',
    'feature.market.title': 'Market Intelligence',
    'feature.market.desc': 'Rank Indian regions against weights you choose, with the evidence behind every score.',
    'feature.partner.title': 'Partner Trust Engine',
    'feature.partner.desc': 'Compare illustrative partner profiles, with verification evidence shown separately from fit.',
    'feature.compliance.title': 'Compliance Copilot',
    'feature.compliance.desc': 'Retrieve curated regulatory passages, each labelled with its source and review status.',
    'feature.gtm.title': 'GTM Simulator',
    'feature.gtm.desc': 'Compare direct export and distributor routes with every cost line visible.',

    'workflow.title': 'Begin your market entry assessment',
    'workflow.body':
      'Describe your product and budget to compare Indian regions. All data is illustrative and deterministic — verify before making business decisions.',
    'translation.title': 'Japanese ↔ English Translation',
    'translation.body':
      'Translate text between Japanese and English. When no translation model is available you will see a clearly-labelled illustrative placeholder — never presented as verified content.',
    'speech.title': 'Japanese Speech → English Translation',
    'speech.body':
      'Speak Japanese into your microphone and receive an English translation. Without a local speech model, a clearly-labelled illustrative placeholder is shown instead.',

    'footer.tagline': 'Nishi — westward, connected',
    'footer.credits':
      'Photography and video via Wikimedia Commons (CC BY, CC BY-SA, CC0): Basile Morin, Nesnad, MaedaAkihiko, David Kernan, Joe Ravi, Dey.sandip, Jakub Hałun, Fly2Blue.',

    'hero.chip1.title': 'Sourced evidence',
    'hero.chip1.desc': 'on every score',
    'hero.chip2.title': 'Human review',
    'hero.chip2.desc': 'before any decision',
    'hero.chip3.title': 'Bilingual',
    'hero.chip3.desc': 'English · 日本語',

    'tour.label': 'Explore the engines',
    'island.label': 'Index',
    'steps.label': 'Assessment progress',
    'steps.profile': 'Profile',
    'steps.markets': 'Markets',
    'steps.evidence': 'Partners & compliance',
    'steps.gtm': 'GTM & report',
    'steps.caption': 'Step {n} of 4',
    'footer.demoStrong': 'Demonstration platform.',
    'footer.demo': 'No live government integrations, real partner credentials, or definitive legal or tariff claims.',
    'footer.provenance':
      'Every source and claim carries explicit provenance and status. Scores, calculations and citations are testable and traceable.',

    'session.checking': 'Checking session…',
    'session.signIn': 'Sign in',
    'session.signOut': 'Sign out',

    'form.title': 'Create India Assessment',
    'form.product': 'Product',
    'form.sector': 'Sector',
    'form.customer': 'Target Customer',
    'form.budget': 'Budget (USD)',
    'form.horizon': 'Horizon (Months)',
    'form.hsCode': 'HS Code (optional)',
    'form.unitValue': 'Unit Value (optional)',
    'form.volume': 'Volume (optional)',
    'form.submit': 'Create assessment',
    'form.submitting': 'Creating…',
    'workflow.created': 'Assessment Created',

    'tr.ja': 'Japanese',
    'tr.en': 'English',
    'tr.placeholder': 'Enter Japanese or English text…',
    'tr.submit': 'Translate',
    'tr.loading': 'Translating…',
    'tr.result': 'Translation',

    'sp.intro': 'Press record and speak Japanese. Audio is sent through your signed-in session to a locally hosted speech model.',
    'sp.record': 'Record Japanese audio',
    'sp.stop': 'Stop recording',
    'sp.loading': 'Translating…',
    'sp.transcript': 'Transcript (Japanese)',
    'sp.translation': 'Translation (English)',
  },
  ja: {
    'nav.engines': 'エンジン',
    'nav.assessment': '評価',
    'nav.translation': '翻訳',
    'nav.speech': '音声',
    'lang.label': '表示言語',

    'hero.eyebrow': '市場参入の意思決定支援 · 日本 → インド',
    'hero.line1': 'インド進出を、',
    'hero.line2Prefix': '',
    'hero.highlight': '明晰',
    'hero.rotate1': '明晰に',
    'hero.rotate2': '根拠とともに',
    'hero.rotate3': '確信をもって',
    'hero.fanLabel': '日本とインドの風景',

    'band.eyebrow': '設計思想',
    'band.title': '検証できること。',
    'band.titleAccent': '信じ込ませないこと。',
    'band.body': 'プラットフォーム上のすべての数値に、出典と前提条件を示しています。',
    'band.engines': '連携エンジン',
    'band.languages': '対応言語',
    'band.routes': '比較する参入ルート',
    'band.assumptions': '前提条件を明示した出力',
    'band.cta': 'JIG-OSで根拠を確認する',

    'nav.jigos': 'JIG-OS',
    'nav.preview': 'プレビュー',
    'hero.jigos': 'JIG-OSを開く',
    'hero.fanJapan': '日本',
    'hero.fanIndia': 'インド',

    'preview.title': 'ログイン前に稟議書をプレビュー',
    'preview.body': '日本工業団地と業種を選ぶと、本社各部門の承認準備度と、すべての回答の根拠となる法令を確認できます。',
    'preview.state': '工業団地',
    'preview.sector': '業種',
    'preview.readiness': '部門準備度',
    'preview.objections': '本社から最初に出る質問',
    'preview.friction': '摩擦指数',
    'preview.frictionHint': '低いほど良好',
    'preview.cta': 'JIG-OSで稟議書を作成する',
    'preview.note': 'ブラウザ内で動作します。デモ用の数値は明示しており、引用条項は確認が必要です。',

    'tour.open': 'JIG-OSで開く',
    'form.offline': '評価サービスから想定どおりの応答がありませんでした。入力内容を引き継ぎ、オフラインで動作するJIG-OSで稟議書を作成できます。',
    'form.offlineCta': 'JIG-OSで続ける',
    'workflow.handoff': 'この評価の稟議書をJIG-OSで作成する',
    'hero.line2Suffix': 'に。',
    'hero.body':
      'インド進出を検討する日本の中小企業のための意思決定支援ワークスペース。地域・パートナー・規制・市場参入コストを、出典と前提条件とともに明示します。',
    'hero.primary': '評価を始める',
    'hero.secondary': '仕組みを見る',

    'features.title': '連携する四つのエンジン',
    'features.body': '各エンジンは、前提条件と制約を明示した追跡可能な結果を出力します。',
    'feature.market.title': '市場インテリジェンス',
    'feature.market.desc': '設定した重みでインドの各地域を順位付けし、すべてのスコアの根拠を示します。',
    'feature.partner.title': 'パートナー信頼エンジン',
    'feature.partner.desc': '例示用のパートナー情報を比較。検証の根拠は適合度とは分けて表示します。',
    'feature.compliance.title': 'コンプライアンス・コパイロット',
    'feature.compliance.desc': '精選した規制関連の条文を、出典とレビュー状況つきで参照できます。',
    'feature.gtm.title': 'GTMシミュレーター',
    'feature.gtm.desc': '直接輸出と販売代理店経由を、すべての費用項目を示して比較します。',

    'workflow.title': '市場参入評価を始める',
    'workflow.body':
      '製品と予算を入力し、インドの各地域を比較します。データはすべて例示用の固定値です。事業判断の前に必ず検証してください。',
    'translation.title': '日本語 ↔ 英語 翻訳',
    'translation.body':
      '日本語と英語の間でテキストを翻訳します。翻訳モデルが利用できない場合は、例示用であることを明記した代替文を表示します。検証済みの内容として扱うことはありません。',
    'speech.title': '日本語音声 → 英語翻訳',
    'speech.body':
      'マイクに向かって日本語で話すと、英語の翻訳が表示されます。ローカルの音声モデルがない場合は、例示用であることを明記した代替文を表示します。',

    'footer.tagline': '西へ、つなぐ。',
    'footer.credits':
      '写真・映像：Wikimedia Commons（CC BY / CC BY-SA / CC0）— Basile Morin、Nesnad、MaedaAkihiko、David Kernan、Joe Ravi、Dey.sandip、Jakub Hałun、Fly2Blue',

    'hero.chip1.title': '出典つきの根拠',
    'hero.chip1.desc': 'すべてのスコアに',
    'hero.chip2.title': '人による確認',
    'hero.chip2.desc': '意思決定の前に',
    'hero.chip3.title': 'バイリンガル',
    'hero.chip3.desc': 'English · 日本語',

    'tour.label': 'エンジンを見る',
    'island.label': '目次',
    'steps.label': '評価の進捗',
    'steps.profile': 'プロフィール',
    'steps.markets': '市場',
    'steps.evidence': 'パートナーと規制',
    'steps.gtm': 'GTMとレポート',
    'steps.caption': 'ステップ {n} / 4',
    'footer.demoStrong': 'デモ用プラットフォームです。',
    'footer.demo': '政府システムとの連携、実在するパートナーの資格情報、法令・関税に関する確定的な判断は含みません。',
    'footer.provenance': 'すべての出典と主張に、由来とステータスを明示しています。スコア・計算・引用は検証と追跡が可能です。',

    'session.checking': 'セッション確認中…',
    'session.signIn': 'ログイン',
    'session.signOut': 'ログアウト',

    'form.title': 'インド市場評価を作成',
    'form.product': '製品',
    'form.sector': '業種',
    'form.customer': '対象顧客',
    'form.budget': '予算（米ドル）',
    'form.horizon': '期間（月）',
    'form.hsCode': 'HSコード（任意）',
    'form.unitValue': '単価（任意）',
    'form.volume': '数量（任意）',
    'form.submit': '評価を作成',
    'form.submitting': '作成中…',
    'workflow.created': '評価を作成しました',

    'tr.ja': '日本語',
    'tr.en': '英語',
    'tr.placeholder': '日本語または英語のテキストを入力…',
    'tr.submit': '翻訳する',
    'tr.loading': '翻訳中…',
    'tr.result': '翻訳結果',

    'sp.intro': '録音を押して日本語で話してください。音声はログイン中のセッションを通じて、ローカルの音声モデルに送信されます。',
    'sp.record': '日本語を録音',
    'sp.stop': '録音を停止',
    'sp.loading': '翻訳中…',
    'sp.transcript': '文字起こし（日本語）',
    'sp.translation': '翻訳（英語）',
  },
} as const

export type MessageKey = keyof (typeof dictionary)['en']

type I18n = { lang: Lang; setLang: (lang: Lang) => void; t: (key: MessageKey) => string }

const I18nContext = createContext<I18n>({
  lang: 'en',
  setLang: () => undefined,
  t: (key) => dictionary.en[key],
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Server render and first client render are English so hydration matches;
  // a stored preference is applied right after mount.
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'ja' || stored === 'en') setLangState(stored)
    } catch {
      // Storage can be unavailable (private mode); English remains the default.
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Preference simply won't persist.
    }
  }, [])

  const t = useCallback((key: MessageKey) => dictionary[lang][key], [lang])

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}

export function LanguageToggle({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { lang, setLang, t } = useI18n()
  const options: { value: Lang; label: string }[] = [
    { value: 'en', label: 'EN' },
    { value: 'ja', label: '日本語' },
  ]
  return (
    <div role="group" aria-label={t('lang.label')} className={`flex items-center border text-xs ${tone === 'dark' ? 'border-white/20' : 'border-hairline'}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={lang === option.value}
          onClick={() => setLang(option.value)}
          lang={option.value}
          className={`min-h-9 whitespace-nowrap px-3 transition-colors ${
            lang === option.value
              ? tone === 'dark' ? 'bg-white text-sumi' : 'bg-sumi text-white'
              : tone === 'dark' ? 'text-white/70 hover:text-white' : 'text-sumi/70 hover:text-sumi'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
