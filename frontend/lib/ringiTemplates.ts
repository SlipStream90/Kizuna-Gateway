// Ringi-sho (稟議書) templates: formal Japanese (keigo / 文語調ビジネス文書) and
// matching English. Pure functions of the analysis, so the document renders
// instantly and identically with or without an LLM.

import { SECTOR_LABEL, stateById } from './jig/engine'
import { SOURCE_BY_ID } from './jig/retrieve'
import type { Lang, RingiAnalysis, RingiSections } from './jig/types'

/** Planning assumption shown in the document; not a live rate. */
export const JPY_PER_USD = 150

const usd = (n: number) => `US$${n.toLocaleString('en-US')}`
const oku = (n: number) => ((n * JPY_PER_USD) / 1e8).toLocaleString('ja-JP', { maximumFractionDigits: 1 })
const tranche = (n: number, pct: number) => Math.round((n * pct) / 100)

export type RingiMeta = {
  subject: string
  date: string
  docNo: string
  originator: string
  route: string
  opening: string
  closing: string
}

export function ringiMeta(a: RingiAnalysis, lang: Lang, date = new Date()): RingiMeta {
  const st = stateById(a.input.stateId)
  const sector = SECTOR_LABEL[a.input.sector]
  const ymd = date.toISOString().slice(0, 10)
  const docNo = `RG-${ymd.replace(/-/g, '')}-${a.input.stateId.slice(0, 3).toUpperCase()}`
  if (lang === 'ja') {
    return {
      subject: `インド・${st.state.ja}（${st.jit.ja}）における${sector.ja}製造拠点設立の件`,
      date: `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`,
      docNo,
      originator: '起案部署：インドデスク',
      route: '決裁区分：取締役会付議事項',
      opening: '標記の件につき、下記のとおり実施いたしたく、ご審議のうえご承認を賜りますようお願い申し上げます。',
      closing: '以上',
    }
  }
  return {
    subject: `Establishment of a manufacturing base for ${sector.en} at ${st.jit.en}, ${st.state.en}, India`,
    date: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    docNo,
    originator: 'Originating department: India Desk',
    route: 'Approval route: Board of Directors',
    opening: 'We respectfully request the Board’s review and approval of the proposal set out below.',
    closing: 'End of proposal',
  }
}

export function ringiSections(a: RingiAnalysis, lang: Lang): RingiSections {
  const { input } = a
  const st = stateById(input.stateId)
  const sector = SECTOR_LABEL[input.sector]
  const partner = input.partner.trim()
  const amt = input.amountUsd
  const refs = a.citationIds
    .map((id, i) => {
      const s = SOURCE_BY_ID.get(id)
      if (!s) return null
      const flag = s.clauseVerified ? '' : lang === 'ja' ? '（条項要確認）' : ' (verify clause)'
      return `[${i + 1}] ${s.authority} — ${s.title[lang]} — ${s.clause[lang]}${flag}`
    })
    .filter(Boolean)
    .join('\n')

  if (lang === 'ja') {
    return {
      overview:
        `当社は、インド市場における${sector.ja}事業の本格展開を目的として、${st.state.ja}${st.jit.ja}に製造拠点を設立することを企図しております。` +
        (partner
          ? `現地パートナーとして${partner}社との協業を予定しており、`
          : '現地パートナーにつきましては現在選定中であり、確定次第改めてご報告申し上げますが、') +
        '日本工業団地（JIT）の支援体制を活用することにより、立ち上げ期間の短縮と品質の早期安定化を図る所存でございます。' +
        `\nなお、主要物流経路は${st.gateway.ja}を想定しております。`,
      capital:
        `総投資額は${usd(amt)}（約${oku(amt)}億円、1米ドル＝${JPY_PER_USD}円にて換算）を予定しております。` +
        '資本投下は撤退・継続判断基準（ゲート）に連動させ、下記の三段階にて実行いたします。\n' +
        `　第一期　用地取得・建屋建設　　${usd(tranche(amt, 40))}（40％）\n` +
        `　第二期　設備導入・試作　　　　${usd(tranche(amt, 30))}（30％）\n` +
        `　第三期　量産立ち上げ　　　　　${usd(tranche(amt, 30))}（30％）\n` +
        '各期の送金は、FC-GPR報告等の法定手続の完了を条件として実行いたします。',
      exitGates:
        '下記いずれかの基準を満たさない場合、次期の投資を保留し、改めてご審議をお願い申し上げます。\n' +
        '　(1) 品質：主要工程の工程能力指数（Cpk）が1.33以上に到達しない場合、第三期の投資を保留いたします。\n' +
        '　(2) 需要：PoC調査における購入意向が5段階評価で3.5を下回った場合、事業計画を見直します。\n' +
        '　(3) 規制：法定届出が期限内に完了しない場合、追加送金を停止いたします。\n' +
        '　(4) 採算：第三期開始後24か月以内に営業損益が黒字化しない場合、撤退を含めて再審議をお願い申し上げます。',
      citations: refs,
    }
  }

  return {
    overview:
      `We propose to establish a manufacturing base for ${sector.en} at ${st.jit.en}, ${st.state.en}, to build our business in the Indian market at scale. ` +
      (partner
        ? `We intend to partner with ${partner}, `
        : 'A local partner is being shortlisted and will be reported to the Board once confirmed; ') +
      'and will use the Japan Industrial Township (JIT) support framework to shorten start-up time and stabilise quality early.' +
      `\nThe primary logistics route is expected to be ${st.gateway.en}.`,
    capital:
      `Total investment is ${usd(amt)} (approx. ¥${oku(amt)} hundred million at a planning rate of ¥${JPY_PER_USD}/US$). ` +
      'Capital will be released in three tranches, each tied to the exit-gate criteria:\n' +
      `  Phase 1  Land & building        ${usd(tranche(amt, 40))} (40%)\n` +
      `  Phase 2  Equipment & trial runs ${usd(tranche(amt, 30))} (30%)\n` +
      `  Phase 3  Mass-production ramp   ${usd(tranche(amt, 30))} (30%)\n` +
      'Each remittance is conditional on completion of statutory filings, including Form FC-GPR.',
    exitGates:
      'If any criterion below is not met, the next tranche is held and the matter returns to the Board.\n' +
      '  (1) Quality: Phase 3 is held unless process capability (Cpk) on critical processes reaches 1.33.\n' +
      '  (2) Demand: the plan is revisited if PoC purchase intent falls below 3.5 / 5.\n' +
      '  (3) Regulatory: further remittances stop if statutory filings are not completed on time.\n' +
      '  (4) Profitability: if operating profit is not positive within 24 months of Phase 3, the Board reconsiders, including exit.',
    citations: refs,
  }
}

export const SECTION_TITLES: Record<keyof RingiSections, { en: string; ja: string }> = {
  overview: { en: '1. Project Overview', ja: '一、案件概要' },
  capital: { en: '2. Capital Commitment', ja: '二、投資金額' },
  exitGates: { en: '3. Exit Gate Criteria', ja: '三、撤退基準' },
  citations: { en: '4. Regulatory Citation Index', ja: '四、規制根拠一覧' },
}
