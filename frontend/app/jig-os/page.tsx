'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Navbar, type ScreenId } from '../../components/jig/Navbar';
import { StateComparison } from '../../components/jig/StateComparison';
import { RingiGenerator } from '../../components/jig/RingiGenerator';
import { EvidenceViewer } from '../../components/jig/EvidenceViewer';
import { StatuteAsk } from '../../components/jig/StatuteAsk';
import { PartnerTrustView } from '../../components/jig/PartnerTrustView';
import { useL } from '../../lib/jig/useL';
import { parseJigQuery } from '../../lib/jig/handoff';
import type { RingiInput } from '../../lib/jig/types';

export default function JigOsPage() {
  const { lang } = useL();
  // The Ringi-sho generator is the hero screen.
  const [screen, setScreen] = useState<ScreenId>('ringi');
  const [preset, setPreset] = useState<{ input: Partial<RingiInput>; autogen: boolean } | null>(null);

  // Deep links from Nishi Link: /jig-os?screen=matrix or ?state=mandal&sector=auto&amount=…&autogen=1
  useEffect(() => {
    const q = parseJigQuery(window.location.search);
    if (q.screen) setScreen(q.screen);
    if (Object.keys(q.input).length || q.autogen) setPreset({ input: q.input, autogen: q.autogen });
  }, []);

  return (
    <>
      <Navbar screen={screen} onScreen={setScreen} />
      <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {screen === 'matrix' && <StateComparison />}
            {screen === 'ringi' && <RingiGenerator preset={preset} />}
            {screen === 'evidence' && <EvidenceViewer />}
            {screen === 'ask' && <StatuteAsk />}
            {screen === 'partners' && <PartnerTrustView />}
          </motion.div>
        </AnimatePresence>
      </div>
      <footer className="border-t border-hairline">
        <p className="mx-auto max-w-[1440px] px-4 py-4 font-mono text-[10px] text-sumi/50 md:px-6">
          {lang === 'ja'
            ? 'JIG-OS デモ — 法的助言ではありません。数値の一部は例示値であり、引用条項は公式条文で確認が必要です。'
            : 'JIG-OS demo — not legal advice. Some figures are illustrative; cited clauses must be checked against the official text.'}
        </p>
      </footer>
    </>
  );
}
