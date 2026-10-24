'use client';

import { motion } from 'framer-motion';
import { Workflow } from '../components/workflow';
import { SessionControls } from '../components/session-controls';
import { TranslationControls } from '../components/translation-controls';
import { SpeechControls } from '../components/speech-controls';

const features = [
  {
    title: 'Market Intelligence',
    desc: 'Weighted regional ranking for Japan SMEs evaluating India expansion.',
    icon: '🗾',
  },
  {
    title: 'Partner Trust Engine',
    desc: 'Fictional partner fit scores with separately displayed verification evidence.',
    icon: '🤝',
  },
  {
    title: 'Compliance Copilot',
    desc: 'Curated source retrieval with explicit provenance and review status.',
    icon: '📜',
  },
  {
    title: 'GTM Simulator',
    desc: 'Decimal-safe direct vs distributor comparisons with line items.',
    icon: '📊',
  },
];

export default function Home() {
  const authError =
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('auth_error')

  return (
    <section className="relative min-h-screen flex flex-col">
      {authError && (
        <div role="alert" className="mx-auto mt-2 rounded-lg border border-akaneiro/30 bg-akaneiro/10 px-4 py-2 text-sm text-akaneiro">
          {authError}
        </div>
      )}
      <nav className="glass-panel px-6 py-4 flex items-center justify-between sticky top-4 z-30 mx-0">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2"
        >
          <div className="w-8 h-8 rounded-full bg-akaneiro flex items-center justify-center text-white font-bold text-lg">K</div>
          <span className="text-xl font-bold text-sumi tracking-tight jp-heading">Kizuna Gateway</span>
        </motion.div>
        <div className="hidden md:flex gap-8 text-sm font-medium text-sumi/80">
          <a href="#market" className="hover:text-aijiro transition-colors">Market</a>
          <a href="#partners" className="hover:text-aijiro transition-colors">Partners</a>
          <a href="#compliance" className="hover:text-aijiro transition-colors">Compliance</a>
          <a href="#gtm" className="hover:text-aijiro transition-colors">GTM</a>
        </div>
        <SessionControls />
      </nav>

      <section className="relative py-20 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="inline-block px-4 py-1.5 rounded-full bg-sakura/50 border border-aijiro/20 text-akaneiro text-sm font-semibold uppercase tracking-wider mb-6"
          >
            Market Entry Decision Support
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-5xl md:text-7xl font-bold text-sumi leading-tight jp-heading mb-6"
          >
            Japan<span className="text-akaneiro"> → </span>India
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-lg md:text-xl text-sumi/70 max-w-xl mx-auto jp-body mb-10"
          >
            A demo-safe market-entry decision-support platform for Japanese SMEs evaluating expansion into India.
            Market Intelligence, Partner Trust, Compliance Copilot, and GTM Simulator — with full provenance and
            human verification.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <button className="glass-button px-8 py-3 text-lg font-semibold flex items-center gap-2 hover:scale-105 transition-transform">
              Start Assessment
              <span className="text-xl">▸</span>
            </button>
            <button className="glass-button secondary px-8 py-3 text-lg font-semibold">
              View Documentation
            </button>
          </motion.div>
        </div>
      </section>

      <section id="features" className="py-24 px-4 bg-sakura/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-sumi mb-4 jp-heading">Four Connected Engines</h2>
            <p className="text-sumi/60 max-w-2xl mx-auto">Each engine produces traceable, auditable output with explicit assumptions and limitations.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                whileHover={{ y: -4 }}
                className="glass-panel p-8 rounded-2xl card-lift hover:border-aijiro/40 transition-all"
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold text-sumi mb-2">{f.title}</h3>
                <p className="text-sumi/60 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="kumiko-divider my-16" />

      <section id="workflow" className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-full bg-aijiro flex items-center justify-center text-white font-bold">1</div>
            <h2 className="text-2xl font-bold text-sumi">Begin Your Market Entry Assessment</h2>
          </div>
          <p className="text-sumi/60 mb-10 jp-body">
            Create a tenant-scoped assessment to compare Indian regions for your product. All data is deterministic
            and illustrative — verification required before business decisions.
          </p>
          <Workflow />
        </div>
      </section>

      <section id="translation" className="py-24 px-4 bg-sakura/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-sumi mb-4 jp-heading">Japanese ↔ English Translation</h2>
            <p className="text-sumi/60 max-w-xl mx-auto">
              Bearer-protected translation through the BFF proxy. The access token stays in the sealed
              server-side session; no token reaches client JavaScript. Falls back to a deterministic
              illustrative placeholder when no translation model is available — never presented as verified content.
            </p>
          </div>
          <div className="glass-panel p-8 rounded-2xl">
            <TranslationControls />
          </div>
        </div>
      </section>

      <section id="speech" className="py-24 px-4 bg-sakura/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-sumi mb-4 jp-heading">Japanese Speech → English Translation</h2>
            <p className="text-sumi/60 max-w-xl mx-auto">
              Bearer-protected speech-to-speech translation. Capture Japanese audio in the browser; it is sent through
              the BFF proxy to a local llama.cpp server running LiquidAI LFM2.5-Audio-1.5B-JP-GGUF. Falls back to an
              illustrative placeholder when no local endpoint is running — never presented as verified content.
            </p>
          </div>
          <div className="glass-panel p-8 rounded-2xl">
            <SpeechControls />
          </div>
        </div>
      </section>

      <section className="py-12 px-4 border-t border-aijiro/20 bg-washi/30">
        <div className="max-w-4xl mx-auto text-sm text-sumi/50 jp-body">
          <p className="mb-2"><strong>Demo-safe MVP.</strong> No live government integrations, real partner credentials, or definite legal/tariff claims without verified inputs.</p>
          <p>Every source and claim has explicit provenance and status. Scores, calculations, and citations are testable and traceable.</p>
        </div>
      </section>
    </section>
  );
}
