// Deterministic Nemawashi engine: department readiness, predicted objections
// with answer packs, and the Chokusan friction index. Same input → same output,
// so a demo run is reproducible in front of judges.

import policies from '../../data/policies.json'
import { retrieveCitations } from './retrieve'
import type {
  DeptReadiness, FrictionIndex, Objection, RingiAnalysis, RingiInput, StateProfile,
} from './types'

export const STATES = policies.states as StateProfile[]
export const stateById = (id: RingiInput['stateId']) => STATES.find((s) => s.id === id)!

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)))

export const SECTOR_LABEL = {
  auto: { en: 'Auto Components', ja: '自動車部品' },
  fmcg: { en: 'FMCG', ja: '日用消費財（FMCG）' },
  robotics: { en: 'Robotics', ja: 'ロボティクス' },
} as const

function readiness(input: RingiInput): DeptReadiness[] {
  const st = stateById(input.stateId)
  const hasPartner = input.partner.trim().length > 0
  const large = input.amountUsd > 50_000_000
  const small = input.amountUsd < 5_000_000
  const power = st.metrics.power.value ?? 98
  const customs = st.metrics.customs.value ?? 3

  const legal = { dept: 'legal' as const, score: 72, drivers: [] as DeptReadiness['drivers'] }
  if (hasPartner) { legal.score += 6; legal.drivers.push({ en: 'Partner named — beneficial-ownership check can start', ja: 'パートナー確定 — 実質的支配者の確認に着手可能' }) }
  else { legal.score -= 10; legal.drivers.push({ en: 'No partner named — Press Note 3 screening pending', ja: 'パートナー未定 — プレスノート3の確認が未了' }) }
  if (large) { legal.score -= 8; legal.drivers.push({ en: 'Large tranche — FEMA pricing & FC-GPR scrutiny', ja: '大型案件 — FEMA価格算定・FC-GPR報告の精査' }) }
  if (input.sector === 'robotics') { legal.score -= 6; legal.drivers.push({ en: 'Robotics — BIS QCO mapping required', ja: 'ロボティクス — BIS品質管理令との対応確認が必要' }) }

  const finance = { dept: 'finance' as const, score: 64, drivers: [] as DeptReadiness['drivers'] }
  const pliBoost = { auto: 12, fmcg: 6, robotics: -4 }[input.sector]
  finance.score += pliBoost
  finance.drivers.push(
    pliBoost > 0
      ? { en: 'Sector PLI available as upside', ja: '業種別PLIを上振れ要因として見込める' }
      : { en: 'No dedicated PLI — relies on state incentive', ja: '専用PLIなし — 州の優遇措置に依存' },
  )
  finance.score += { neemrana: 3, mandal: 5, sricity: 4 }[input.stateId]
  if (large) { finance.score -= 6; finance.drivers.push({ en: 'FX exposure on large USD commitment', ja: '大型ドル建て投資に伴う為替リスク' }) }
  if (small) { finance.score += 4; finance.drivers.push({ en: 'Within delegated approval band', ja: '決裁権限内の投資規模' }) }

  const plant = { dept: 'plant' as const, score: 58, drivers: [] as DeptReadiness['drivers'] }
  plant.score += (power - 98) * 10
  plant.drivers.push({ en: `Grid reliability ${power}% (illustrative)`, ja: `電力供給信頼度 ${power}％（例示）` })
  plant.score += { auto: 8, fmcg: 2, robotics: -4 }[input.sector]
  if (input.sector === 'auto') plant.drivers.push({ en: 'Established JIS-literate supplier base', ja: 'JISに精通したサプライヤー基盤が存在' })
  if (hasPartner) plant.score += 4
  plant.drivers.push({ en: 'Latest AR audit Cpk 1.21 vs gate 1.33', ja: '直近AR監査のCpk 1.21（ゲート基準 1.33）' })

  const indiaDesk = { dept: 'indiaDesk' as const, score: 70, drivers: [] as DeptReadiness['drivers'] }
  indiaDesk.score += 4
  indiaDesk.drivers.push({ en: 'JIT support desk available', ja: 'JIT支援窓口を利用可能' })
  if (hasPartner) { indiaDesk.score += 12; indiaDesk.drivers.push({ en: `Partner: ${input.partner}`, ja: `パートナー：${input.partner}` }) }
  else { indiaDesk.score -= 12 }
  if (customs < 3) { indiaDesk.score += 5; indiaDesk.drivers.push({ en: `Customs ~${customs} days (illustrative)`, ja: `通関 約${customs}日（例示）` }) }

  return [legal, finance, plant, indiaDesk].map((d) => ({ ...d, score: clamp(d.score, 20, 97) }))
}

function objections(input: RingiInput): Objection[] {
  const st = stateById(input.stateId)
  const hasPartner = input.partner.trim().length > 0
  const partner = input.partner.trim()
  const large = input.amountUsd > 50_000_000
  const out: Objection[] = []

  out.push({
    id: 'legal-fdi-route', dept: 'legal', severity: hasPartner ? 'medium' : 'high',
    question: { en: 'Is this on the automatic route, or does it need Government approval?', ja: '本件は自動承認ルートの対象か、それとも政府承認を要するか。' },
    answer: {
      en: `Manufacturing is on the automatic route under the Consolidated FDI Policy. Press Note 3 approval applies only if a beneficial owner is from a land-border country${hasPartner ? ` — obtain a beneficial-ownership declaration from ${partner}` : ' — screen the partner once named'}.`,
      ja: `統合FDI政策上、製造業は自動承認ルートの対象です。プレスノート3による承認は、実質的支配者が陸上国境を接する国に属する場合に限り必要となります${hasPartner ? `。${partner}社より実質的支配者に関する申告書を取得いたします` : '。パートナー確定後に確認いたします'}。`,
    },
    citations: ['dpiit-fdi-2020', 'dpiit-pn3-2020'],
  })
  out.push({
    id: 'legal-fema-reporting', dept: 'legal', severity: large ? 'high' : 'medium',
    question: { en: 'How are share pricing and RBI reporting handled?', ja: '株式の価格算定およびインド準備銀行への報告はどのように対応するか。' },
    answer: {
      en: 'Equity is priced under FEMA (NDI) Rules Schedule I and each allotment is reported on Form FC-GPR via the FIRMS portal. Tranche releases are tied to completed filings.',
      ja: '資本性証券はFEMA（非債務性証券）規則別表Iに基づき価格を算定し、各割当はFIRMSポータルにて様式FC-GPRにより報告いたします。各トランシェの送金は、届出完了を条件といたします。',
    },
    citations: ['fema-ndi-2019', 'rbi-md-fi'],
  })
  out.push({
    id: 'legal-resident-director', dept: 'legal', severity: 'low',
    question: { en: 'Who satisfies the resident-director requirement?', ja: '居住取締役の要件は誰が充足するか。' },
    answer: {
      en: 'The India Desk lead will be posted for ≥182 days in year one; a local independent director is the fallback.',
      ja: '初年度はインドデスク責任者が182日以上駐在いたします。代替案として現地の独立取締役を選任いたします。',
    },
    citations: ['companies-act-149'],
  })

  const pli = {
    auto: { en: 'Treat the Auto PLI as upside only until group-revenue and minimum-investment eligibility is confirmed; the base case excludes it.', ja: '自動車PLIは、グループ売上高および最低投資額の適格性が確認されるまで上振れ要因としてのみ扱い、基本ケースには含めません。', c: ['pli-auto-2021'] },
    fmcg: { en: 'Food-processing PLI rates are category-specific; base case excludes them until the product category is confirmed eligible.', ja: '食品加工PLIの率はカテゴリーごとに異なるため、製品カテゴリーの適格性確認までは基本ケースに含めません。', c: ['pli-food-2021'] },
    robotics: { en: 'There is no dedicated robotics PLI; the case rests on state incentives and CEPA tariff preferences for imported sub-assemblies.', ja: 'ロボティクス専用のPLIは存在しないため、州の優遇措置および輸入サブアセンブリに対するCEPA特恵関税を前提といたします。', c: ['ijcepa-2011'] },
  }[input.sector]
  const stateSrc = { neemrana: 'rips-2024', mandal: 'gujarat-ip-2020', sricity: 'ap-idp-2023' }[input.stateId]
  out.push({
    id: 'finance-incentives', dept: 'finance', severity: input.sector === 'robotics' ? 'high' : 'medium',
    question: { en: 'Can incentives be counted in the base-case IRR?', ja: '基本ケースのIRRに優遇措置を算入してよいか。' },
    answer: { en: `${pli.en} State incentives (${st.metrics.stateIncentive.display.en}) are shown separately.`, ja: `${pli.ja}州の優遇措置（${st.metrics.stateIncentive.display.ja}）は別途表示いたします。` },
    citations: [...pli.c, stateSrc],
  })
  out.push({
    id: 'finance-repatriation', dept: 'finance', severity: 'medium',
    question: { en: 'How will profits be repatriated, and at what tax cost?', ja: '利益の本国送金はどのように行い、税負担はどの程度か。' },
    answer: {
      en: 'Dividends to the parent fall under Article 10 of the India–Japan DTAA; a Tax Residency Certificate is filed annually to claim treaty rates.',
      ja: '親会社への配当は日印租税条約第10条の対象となります。条約上の税率適用のため、居住者証明書を毎年提出いたします。',
    },
    citations: ['dtaa-india-japan'],
  })
  if (large) out.push({
    id: 'finance-csr', dept: 'finance', severity: 'low',
    question: { en: 'Will CSR obligations apply?', ja: 'CSR義務は適用されるか。' },
    answer: { en: 'At this scale the subsidiary is likely to cross a s.135 threshold by year three; 2% of average net profit is budgeted from then.', ja: '本規模では3年目までに第135条の基準を超える見込みのため、その時点から平均純利益の2％を予算計上いたします。' },
    citations: ['companies-act-135'],
  })

  out.push({
    id: 'plant-jis', dept: 'plant', severity: input.sector === 'fmcg' ? 'medium' : 'high',
    question: { en: 'Can the line hold JIS-equivalent tolerance?', ja: 'ラインはJIS相当の公差を維持できるか。' },
    answer: {
      en: 'Scale-up is gated on Cpk ≥ 1.33 for critical dimensions (latest AR audit: 1.21). Product specs are mapped to the applicable BIS standard before launch.',
      ja: '量産移行は、重要寸法のCpkが1.33以上であることを条件といたします（直近AR監査：1.21）。製品仕様は立ち上げ前に該当するBIS規格へ対応付けます。',
    },
    citations: ['bis-act-2016'],
  })
  if ((st.metrics.power.value ?? 100) < 99) out.push({
    id: 'plant-power', dept: 'plant', severity: 'medium',
    question: { en: 'Is grid reliability adequate for continuous operation?', ja: '電力供給の信頼度は連続稼働に十分か。' },
    answer: { en: 'Captive backup is sized for critical loads; distribution-licensee reliability reporting under the 2020 Rules is tracked monthly.', ja: '重要負荷に対して自家発電設備を確保し、2020年規則に基づく配電事業者の信頼度報告を毎月確認いたします。' },
    citations: ['elec-consumer-rules-2020'],
  })

  out.push(hasPartner ? {
    id: 'india-partner', dept: 'indiaDesk', severity: 'low',
    question: { en: `Is ${partner} operationally ready?`, ja: `${partner}社の運営体制は整っているか。` },
    answer: { en: 'Kiosk PoC and AR audits are linked as evidence (see Evidence & Audit Trail); open kaizen items are tracked to closure before Gate 2.', ja: 'キオスクPoCおよびAR監査を証拠として紐づけております（証拠・監査証跡を参照）。未完了の改善項目はゲート2までに完了させます。' },
    citations: ['jetro-jit'],
  } : {
    id: 'india-partner', dept: 'indiaDesk', severity: 'high',
    question: { en: 'Who is the local partner?', ja: '現地パートナーはどこか。' },
    answer: { en: 'Shortlist from the JIT tenant network; the proposal is resubmitted once a partner is named.', ja: 'JIT入居企業ネットワークから候補を選定し、パートナー確定後に本稟議を再提出いたします。' },
    citations: ['jetro-jit'],
  })
  if ((st.metrics.customs.value ?? 0) > 3) out.push({
    id: 'india-customs', dept: 'indiaDesk', severity: 'medium',
    question: { en: 'Will customs clearance delay commissioning?', ja: '通関が設備の立ち上げを遅らせないか。' },
    answer: { en: 'Bills of entry are filed in advance under s.46 and CEPA origin certificates are prepared with the shipper.', ja: '第46条に基づき輸入申告を事前に行い、CEPA原産地証明書を荷主と共に準備いたします。' },
    citations: ['customs-act-46', 'ijcepa-2011'],
  })

  const rank = { high: 0, medium: 1, low: 2 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity])
}

function friction(input: RingiInput, r: DeptReadiness[]): FrictionIndex {
  const score = (d: DeptReadiness['dept']) => r.find((x) => x.dept === d)!.score
  const spread = Math.max(...r.map((x) => x.score)) - Math.min(...r.map((x) => x.score))
  return {
    complianceGap: clamp(100 - (score('legal') + score('indiaDesk')) / 2),
    consensusHorizonGap: clamp(spread * 1.2 + (input.amountUsd > 50_000_000 ? 15 : input.amountUsd > 5_000_000 ? 8 : 0)),
    qualityVariance: clamp(100 - score('plant') + (input.sector === 'robotics' ? 8 : 0)),
  }
}

export function analyse(input: RingiInput): RingiAnalysis {
  const r = readiness(input)
  const objs = objections(input)
  const retrieved = retrieveCitations(input).map((x) => x.id)
  // Every source an answer pack cites must appear in the index, ahead of retrieval-only hits.
  const cited = [...new Set(objs.flatMap((o) => o.citations))]
  const citationIds = [...new Set([...cited, ...retrieved])]
  return { input, readiness: r, objections: objs, friction: friction(input, r), citationIds }
}
