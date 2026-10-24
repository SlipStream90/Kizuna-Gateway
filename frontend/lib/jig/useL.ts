'use client'

import { useI18n } from '../i18n'
import type { Bilingual } from './types'

/** JIG-OS labels live beside their components as {en, ja} pairs; this picks the active one. */
export function useL() {
  const { lang } = useI18n()
  return { lang, L: (b: Bilingual) => b[lang] }
}
