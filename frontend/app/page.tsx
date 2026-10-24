'use client';

import { Calculator, Handshake, MapPinned, ScrollText } from 'lucide-react';
import { Workflow } from '../components/workflow';
import { TranslationControls } from '../components/translation-controls';
import { SpeechControls } from '../components/speech-controls';
import { FanHero } from '../components/landing/FanHero';
import { EvidenceBand } from '../components/landing/EvidenceBand';
import { RingiPreview } from '../components/landing/RingiPreview';
import { FeatureTour } from '../components/watermelon/feature-tour';
import { ScrollIsland } from '../components/watermelon/scroll-island';
import { Reveal, RevealItem } from '../components/watermelon/reveal';
import { useI18n, type MessageKey } from '../lib/i18n';
import { jigHref, type JigScreen } from '../lib/jig/handoff';

// Each engine opens the JIG-OS screen that shows it working.
const engines: { key: string; kanji: string; icon: typeof MapPinned; image: string; screen: JigScreen }[] = [
  { key: 'market', kanji: '市場', icon: MapPinned, image: '/media/gateway-of-india.webp', screen: 'matrix' },
  { key: 'partner', kanji: '信頼', icon: Handshake, image: '/media/howrah-bridge.webp', screen: 'evidence' },
  { key: 'compliance', kanji: '法令', icon: ScrollText, image: '/media/torii-path.webp', screen: 'ringi' },
  { key: 'gtm', kanji: '戦略', icon: Calculator, image: '/media/shinkansen-fuji.webp', screen: 'ringi' },
];

function SectionHeading({ index, kanji, title, children }: { index: string; kanji: string; title: string; children?: React.ReactNode }) {
  return (
    <Reveal className="mb-12 grid gap-4 md:grid-cols-[10rem_1fr]">
      <RevealItem>
        <p className="eyebrow pt-2">
          {index} <span className="ml-2 font-serif normal-case tracking-normal text-akaneiro">{kanji}</span>
        </p>
      </RevealItem>
      <RevealItem>
        <h2 className="jp-heading text-3xl md:text-4xl text-sumi">{title}</h2>
        {children && <p className="mt-4 max-w-2xl text-sumi/70 jp-body">{children}</p>}
      </RevealItem>
    </Reveal>
  );
}

export default function Home() {
  const { t } = useI18n();
  const authError =
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('auth_error')

  const topics = [
    { id: 'features', title: t('features.title') },
    { id: 'preview', title: t('preview.title') },
    { id: 'workflow', title: t('workflow.title') },
    { id: 'translation', title: t('translation.title') },
    { id: 'speech', title: t('speech.title') },
  ];

  return (
    <>
      {authError && (
        <div role="alert" className="mx-auto max-w-6xl px-5 pt-4 text-sm text-akaneiro md:px-10">
          {authError}
        </div>
      )}

      <FanHero />
      <ScrollIsland topics={topics} label={t('island.label')} />

      <div className="mx-auto max-w-6xl px-5 md:px-10">
        <section id="features" className="scroll-mt-24 py-24">
          <SectionHeading index="01" kanji="四" title={t('features.title')}>{t('features.body')}</SectionHeading>
          <Reveal>
            <RevealItem>
              <FeatureTour
                label={t('tour.label')}
                steps={engines.map((e) => ({
                  id: e.key,
                  kanji: e.kanji,
                  title: t(`feature.${e.key}.title` as MessageKey),
                  description: t(`feature.${e.key}.desc` as MessageKey),
                  icon: <e.icon className="size-7" strokeWidth={1.5} aria-hidden />,
                  image: e.image,
                  href: jigHref({ screen: e.screen }),
                  hrefLabel: t('tour.open'),
                }))}
              />
            </RevealItem>
          </Reveal>
        </section>
      </div>

      <EvidenceBand />

      <div className="mx-auto max-w-6xl px-5 md:px-10">
        <section id="preview" className="scroll-mt-24 py-24">
          <SectionHeading index="02" kanji="稟" title={t('preview.title')}>{t('preview.body')}</SectionHeading>
          <Reveal className="md:ml-[11rem]">
            <RevealItem>
              <RingiPreview />
            </RevealItem>
          </Reveal>
        </section>

        <div className="kumiko-divider" />

        <section id="workflow" className="scroll-mt-24 py-24">
          <SectionHeading index="03" kanji="始" title={t('workflow.title')}>{t('workflow.body')}</SectionHeading>
          <Reveal className="md:ml-[11rem]">
            <RevealItem>
              <Workflow />
            </RevealItem>
          </Reveal>
        </section>

        <div className="kumiko-divider" />

        <section id="translation" className="scroll-mt-24 py-24">
          <SectionHeading index="04" kanji="訳" title={t('translation.title')}>{t('translation.body')}</SectionHeading>
          <Reveal className="md:ml-[11rem]">
            <RevealItem className="glass-panel p-6 md:p-8">
              <TranslationControls />
            </RevealItem>
          </Reveal>
        </section>

        <div className="kumiko-divider" />

        <section id="speech" className="scroll-mt-24 py-24">
          <SectionHeading index="05" kanji="声" title={t('speech.title')}>{t('speech.body')}</SectionHeading>
          <Reveal className="md:ml-[11rem]">
            <RevealItem className="glass-panel p-6 md:p-8">
              <SpeechControls />
            </RevealItem>
          </Reveal>
        </section>
      </div>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-12 text-sm text-sumi/60 md:flex-row md:justify-between md:px-10">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="hanko h-6 w-6 text-xs" aria-hidden>西</span>
              <span className="jp-heading text-sumi">{t('footer.tagline')}</span>
            </div>
            <a href="/jig-os" className="inline-flex items-center gap-1.5 text-sumi underline decoration-hairline underline-offset-4 hover:decoration-akaneiro">
              <span className="rounded-[2px] bg-sumi px-1.5 py-0.5 font-mono text-[10px] text-white no-underline">OS</span>
              {t('hero.jigos')}
            </a>
          </div>
          <div className="max-w-xl space-y-2 jp-body">
            <p><strong className="font-medium text-sumi">{t('footer.demoStrong')}</strong> {t('footer.demo')}</p>
            <p>{t('footer.provenance')}</p>
            <p className="text-xs text-sumi/45">{t('footer.credits')}</p>
          </div>
        </div>
      </footer>
    </>
  );
}
