# UI Design Audit — Customer Appeal & Professionalism

Date: 2026-10-24. Method: Playwright (Chrome) at 1440×900 and 390×844, with scripted checks for
console errors, broken anchors, dead CTAs, unlabelled inputs, contrast, motion/blur load and jargon,
plus visual review of full-page screenshots. Design references came from the Watermelon UI MCP
(`compose_page`, `get_inspiration`; `hero-22` "calm editorial, warm paper" block).

## Findings (before)

| # | Severity | Finding |
|---|---|---|
| 1 | High | Hero CTAs "Start Assessment" / "View Documentation" were `<button>`s with no action. |
| 2 | High | Nav links `#market`, `#partners`, `#compliance`, `#gtm` pointed at sections that do not exist. |
| 3 | High | Feature cards used `whileInView` from `opacity: 0`; they rendered as an empty ~350px block until scrolled into view. |
| 4 | High | Hydration mismatch in `SpeechControls` (`MediaRecorder` checked during render) — Next dev overlay showed "1 Issue". |
| 5 | Medium | Autoplaying 4-clip background video at 40% opacity + 24 falling petals + 12 blurred glass panels: busy, washed-out text, heavy load. Petals rendered as a row of dots along the top edge. |
| 6 | Medium | Customer-facing copy full of internals: "BFF", "Bearer", "tenant-scoped", "llama.cpp", "LFM2.5…GGUF", "Decimal-safe", "MVP". |
| 7 | Medium | Duplicate headings (section H2 + identical component H2) for Translation and Speech; nested glass panels. |
| 8 | Medium | 8 form inputs had visual labels not associated with the input (`htmlFor`/`id`). |
| 9 | Low | Emoji icons (🗾 🤝 📜 📊) and gradient buttons undercut a professional B2B tone. |
| 10 | Low | Secondary CTA (red text on translucent pink) had weak contrast; no favicon (404). |
| 11 | Low | System font only; no typographic hierarchy distinguishing headings from UI text. |

## Direction: Japanese minimalism

- **Ma (間)** — generous whitespace, one idea per section, numbered sections (01–04) on a left rail.
- **Palette** — kinari paper `#f6f4ef`, sumi ink `#1c1c1c`, hairline `#e2ddd2`, a single shu/vermilion accent `#b7282e` used only for the hanko seal, kanji markers and one emphasised word.
- **Type** — Noto Serif JP (mincho) for headings, Noto Sans JP for UI/body.
- **Surfaces** — flat paper with 1px hairlines, 2–4px radii; no blur, gradients, glow or hover lift.
- **Motifs** — 絆 (kizuna) hanko seal as brand mark/favicon, ensō brush circle in the hero, kanji labels (市場 信頼 法令 戦略) in place of emoji.

## Changes made

- `app/globals.css` — new token palette and flat component classes (`glass-panel`, `glass-button`, `glass-input` restyled in place so every component inherits the theme); reduced-motion support.
- `app/layout.tsx` — removed background video and sakura overlay; added Noto Serif/Sans JP.
- `app/page.tsx` — new editorial hero, working CTAs/anchors, hairline feature grid, plain-language copy, footer.
- `app/icon.svg` — hanko favicon.
- `components/*` — duplicate headings and nested panels removed, labels linked to inputs, hairline borders, speech-model jargon replaced, hydration fix.
- `tests/e2e.spec.ts` — nav test updated to the new (working) anchor.

## Results (after)

0 console errors, 0 broken anchors, 0 dead CTAs, 0 unlabelled inputs, 0 blurred layers, 0 videos,
no jargon in page copy, favicon present. E2E: 6/7 pass; "translation form submits" fails without a
running backend because the request errors too quickly for the "Translating…" state to be observed
(unrelated to styling).

## Further recommendations

1. Add a real documentation/"How it works" page and a sample report preview so prospects can see output before signing in.
2. Add social proof appropriate to a demo (e.g. "Built for SMEs in precision manufacturing, food, textiles").
3. Offer a 日本語 toggle — the audience is Japanese SMEs.
4. The `public/videos` assets (~MBs) are now unused; delete them or keep a single still poster if imagery is wanted.

## Revision 2 — Nishi Link rebrand, Watermelon components, motion and imagery

Brand renamed to **Nishi Link** (西, "west" — Japan looking west to India); hanko seal and favicon use 西.
The first pass read as static and image-free, so the page was rebuilt on adapted Watermelon UI pieces
(sources in `frontend/components/watermelon/`, each file headed with its origin URL):

| Watermelon source | Used for | Adaptation |
|---|---|---|
| `block/hero-22` | Hero | Same spring/blur stagger variants and chip row; local Togetsukyō bridge video instead of a remote image; washi wash for legibility; reduced-motion shows the poster only. |
| `animated-components/feature-tour` | Four engines | Inline instead of a dialog; icon morph + blur slide kept; auto-advance (paused on hover/focus/reduced motion); one photo per engine; headings wrap buttons (accordion pattern) so they stay in the a11y tree. |
| `animated-components/scroll-island` | Floating 目次/Index | Tracks window scroll, appears after the hero, conic progress ring in vermilion, Esc closes. |
| `animated-components/step-indicator` | Assessment progress | Shows real progress (completed/current/upcoming); clip-path tooltip kept; lucide icons. |

Imagery reuses the CC BY / CC BY-SA Wikimedia footage already in `public/videos/` (see its
`ATTRIBUTION.md`); a credit line was added to the footer. New dependencies: `motion`, `lucide-react`.
