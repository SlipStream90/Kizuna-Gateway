import { test, expect } from '@playwright/test'

test.use({ baseURL: 'http://localhost:3000' })

test.describe('Nishi Link frontend', () => {
  test('home page loads with no CSS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto('/')
    await expect(page.getByText('Nishi Link')).toBeVisible()
    const cssErrors = errors.filter(e => e.includes('CSS') || e.includes('tailwind') || e.includes('postcss'))
    expect(cssErrors).toEqual([])
  })

  test('four engine cards render', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Market Intelligence' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Partner Trust Engine' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Compliance Copilot' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'GTM Simulator' })).toBeVisible()
  })

  test('translation form submits through BFF proxy', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('heading', { name: /Japanese ↔ English Translation/ }).waitFor()
    const textarea = page.getByLabel('Text to translate')
    await textarea.click()
    await textarea.fill('Konnichiwa')
    const translateBtn = page.getByRole('button', { name: /Translate/ })
    await expect(translateBtn).toBeEnabled({ timeout: 5000 })
    await translateBtn.click()
    // Button shows Translating… during API call, then clears (result needs backend; error without)
    await expect(translateBtn).toContainText(/Translating/, { timeout: 5000 })
    await expect(translateBtn).not.toContainText(/Translating/, { timeout: 15000 })
  })

  test('translation language swap works', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('heading', { name: /Japanese ↔ English Translation/ }).waitFor()
    const sourceSelect = page.getByLabel('Source language')
    await sourceSelect.click()
    await sourceSelect.selectOption('en')
    const targetSelect = page.getByLabel('Target language')
    await targetSelect.click()
    await targetSelect.selectOption('ja')
    await expect(page.getByLabel('Source language')).toHaveValue('en')
    await expect(page.getByLabel('Target language')).toHaveValue('ja')
  })

  test('speech controls render', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('heading', { name: /Japanese Speech → English Translation/ }).waitFor()
    await expect(page.getByRole('button', { name: /Record Japanese audio/ })).toBeVisible()
  })

  test('session controls render', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /Sign in/ })).toBeVisible()
  })

  test('navigation links work', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Engines' }).click()
    await expect(page).toHaveURL(/\/#features/)
    await expect(page.locator('#features')).toBeInViewport()
  })
})

test.describe('Nishi Link ⇄ JIG-OS', () => {
  test('landing links into JIG-OS and back', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: /JIG-OS/ }).click()
    await expect(page).toHaveURL(/\/jig-os/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Ringi-sho')
    await page.getByRole('link', { name: /Back to Nishi Link|Nishi Link/ }).first().click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('preview hands its inputs to JIG-OS and auto-generates', async ({ page }) => {
    await page.goto('/#preview', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Sri City' }).click()
    await page.getByRole('link', { name: /Draft the full Ringi-sho in JIG-OS/ }).click()
    await expect(page).toHaveURL(/state=sricity.*autogen=1/)
    await expect(page.locator('article')).toContainText('Sri City')
  })
})

// The statutory RAG endpoint is mocked so these run without the API, a database or an API key.
const ANSWER_SOURCE = {
  id: 'b9c7a1d2-0000-4000-8000-000000000001', document_code: 'RBI-MD-FI',
  document_title: 'RBI Master Direction - Foreign Investment', authority: 'RBI',
  clause_reference: 'Paragraph 4.2', citation_id: 'RBI-MD-FI/Paragraph 4.2',
  citation: '[RBI MD-FI, Paragraph 4.2]', similarity: 0.74,
  content: '4.2 Form FC-GPR shall be filed within 30 days of the date of issue.',
  page_start: 2, page_end: 3, source_url_or_file: 'rbi.pdf', last_verified_date: null,
  badge: {
    id: 'RBI-MD-FI/Paragraph 4.2', authority: 'RBI',
    title: { en: 'RBI Master Direction - Foreign Investment', ja: 'RBI Master Direction - Foreign Investment' },
    clause: { en: 'Paragraph 4.2', ja: 'パラグラフ4.2' }, clauseVerified: false,
    label: { en: '[RBI MD-FI, Paragraph 4.2]', ja: '［RBI MD-FI、パラグラフ4.2］' },
    url: null, file: 'rbi.pdf', summary: { en: 'Form FC-GPR within 30 days.', ja: 'Form FC-GPR within 30 days.' }, similarity: 0.74,
  },
}

function answered(lang: 'en' | 'ja') {
  return {
    query: 'q', lang, status: 'answered', removed_paragraphs: 1, notice: null,
    generation_model: 'claude-opus-5-5', embedding_model: 'm', semantic: true, review_required: true,
    sources: [ANSWER_SOURCE], citation_index: [],
    answer: [
      { text: 'Form FC-GPR must be filed within 30 days of the date of issue.', citations: ['RBI-MD-FI/Paragraph 4.2'], badges: [ANSWER_SOURCE.badge], figures_verified: true },
      { text: 'A late fee applies after 90 days.', citations: ['RBI-MD-FI/Paragraph 4.2'], badges: [ANSWER_SOURCE.badge], figures_verified: false },
    ],
  }
}

test.describe('JIG-OS statutory RAG', () => {
  test('Ask the Statutes renders a grounded, cited answer and flags unverified figures', async ({ page }) => {
    await page.route('**/api/v1/compliance/answer', (route) => route.fulfill({ json: answered('en') }))
    await page.goto('/jig-os?screen=ask', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /Form FC-GPR/ }).click()
    await expect(page.getByText('Grounded answer')).toBeVisible()
    await expect(page.getByText('Form FC-GPR must be filed within 30 days of the date of issue.')).toBeVisible()
    await expect(page.getByText('A figure in this paragraph does not appear in the cited text.', { exact: false })).toBeVisible()
    await expect(page.getByText('1 paragraph(s) citing no retrieved clause were removed.')).toBeVisible()
  })

  test('Ask the Statutes explains when the API is unreachable', async ({ page }) => {
    await page.route('**/api/v1/compliance/answer', (route) => route.fulfill({ status: 500, body: '' }))
    await page.goto('/jig-os?screen=ask', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /director resident/ }).click()
    await expect(page.getByText('The Kizuna API is not reachable', { exact: false })).toBeVisible()
  })

  test('Ringi-sho gains a live regulatory analysis section from ingested statutes', async ({ page }) => {
    await page.route('**/api/v1/compliance/answer', (route) => route.fulfill({ json: answered('en') }))
    await page.goto('/jig-os?screen=ringi', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /Generate Honsha-Ready/ }).click()
    await expect(page.getByRole('heading', { name: /4\. Regulatory Analysis \(from ingested statutes\)/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: '5. Regulatory Citation Index' })).toBeVisible()
    await expect(page.getByText('Added a regulatory analysis citing 1 clause(s)', { exact: false })).toBeVisible()
  })
})


// Partner Trust & Verification (mocked API: runs without backend or database).
const PARTNER_ID = '6f1c2f0e-0000-5000-8000-000000000006'
const DIRECTORY = {
  total: 2, scoring_version: 'trust-v1', disclosure: 'Advisory screening only.',
  partners: [
    { id: '6f1c2f0e-0000-5000-8000-000000000001', partner_name: 'Hikari Precision Components (fictional)', record_source: 'simulated_fixture', simulated: true,
      sector: 'auto', state: 'Gujarat', city: 'Becharaji', partner_type: 'supplier', score: '97.4', tier: 'japan_ready',
      otd_trailing_pct: '97.0', litigation_flag: false, credit_band: 'low', iso_verified: ['ISO 9001', 'ISO 14001'], block_flags: 0, warn_flags: 0 },
    { id: PARTNER_ID, partner_name: 'Yamuna FMCG Logistics (fictional)', record_source: 'simulated_fixture', simulated: true,
      sector: 'fmcg', state: 'Haryana', city: 'Gurugram', partner_type: 'distributor', score: '49.0', tier: 'not_recommended',
      otd_trailing_pct: '96.3', litigation_flag: true, credit_band: 'low', iso_verified: ['ISO 9001'], block_flags: 1, warn_flags: 0 },
  ],
}
const record = (name: string, state: string) => ({
  id: PARTNER_ID, partner_name: name, record_source: 'simulated_fixture', sector: 'fmcg', state, city: 'Gurugram',
  partner_type: 'distributor', mca_registration_no: 'U29306ZZ2004PTC000006', gstin: '00ZZZCF0006A1Z6',
  registered_address: 'Plot 42 (fictional address)', incorporated_on: '2004-04-01',
  mca_compliance: { status: 'active', annual_filings_on_time_last3: 3, last_annual_return_fy: '2025-26' },
  gst_compliance: { status: 'active', returns_on_time_last12: 12, last_return_period: '2026-09' },
  director_history: [{ name: 'H. Malhotra (fictional)', din: 'SIM-0006-1', role: 'Managing Director', appointed_on: '2004-01-01', ceased_on: null }],
  litigation: [{ forum: 'ITAT (simulated)', case_type: 'tax', status: 'pending', severity: 'major', summary: 'Disputed transfer-pricing demand', reference: 'SIM-ITA-2024-0412' }],
  financial_solvency_score: '79.00', credit_rating: { agency: 'D&B-equivalent rating (simulated)', band: 'low', as_of: '2026-09-30' },
  iso_certifications: [{ standard: 'ISO 9001', status: 'verified', certificate_no: 'SIM-9001-0006', certification_body: null, valid_until: '2028-03-31' }],
  operations: { otd_monthly_pct: Array(12).fill('96.3'), fulfillment_accuracy_pct: '98.8', client_retention_pct: '90',
    foreign_principal_satisfaction_pct: '88', sla_compliance_pct: '96' },
  cross_border: { contracts_total: 11, contracts_fulfilled: 11, japanese_principals: 2 }, data_as_of: '2026-09-30',
})
const AUDIT = {
  partner_id: PARTNER_ID, partner_name: 'Yamuna FMCG Logistics (fictional)', record_source: 'simulated_fixture', simulated: true,
  score: '49.0', uncapped_score: '85.9', tier: 'not_recommended', otd_trailing_pct: '96.3',
  components: [
    { key: 'mca', label: 'MCA compliance & filing status', points: '15.0', max_points: '15', reasons: ['MCA status: active (9 pts)'] },
    { key: 'litigation', label: 'Litigation exposure', points: '0', max_points: '10', reasons: ['1 pending major tax/corporate matter(s) (0 pts)'] },
  ],
  flags: [{ level: 'block', code: 'litigation_major', message: 'Pending major tax matter: Disputed transfer-pricing demand (SIM-ITA-2024-0412).' }],
  evidence: [{ label: 'MCA company master data · CIN U29306ZZ2004PTC000006', url: 'https://www.mca.gov.in/', note: 'Search by CIN (simulated record — it will not be found on the portal)' }],
  scoring_version: 'trust-v1', inputs_hash: 'a'.repeat(64), computed_at: '2026-10-24T00:00:00Z', disclosure: 'Advisory screening only.',
  record: record('Yamuna FMCG Logistics (fictional)', 'Haryana'),
}

test.describe('JIG-OS Partner Trust & Verification', () => {
  test('directory, gated scorecard, simulated labelling and Ringi hand-off', async ({ page }) => {
    await page.route('**/api/v1/partners?**', (route) => route.fulfill({ json: DIRECTORY }))
    await page.route('**/api/v1/partners', (route) => route.fulfill({ json: DIRECTORY }))
    await page.route('**/api/v1/partners/*/audit-score', (route) => route.fulfill({ json: AUDIT }))
    await page.goto('/jig-os?screen=partners', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Partner Trust & Verification' })).toBeVisible()
    await expect(page.getByText('All records are simulated fixtures', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: /Yamuna FMCG Logistics/ }).click()
    await expect(page.getByText('capped by gate (uncapped 85.9)')).toBeVisible()
    await expect(page.getByText('Pending major tax matter', { exact: false })).toBeVisible()
    await expect(page.getByText('Simulated fixture', { exact: true })).toBeVisible()
    const ringi = page.getByRole('link', { name: 'Use in Ringi-sho' })
    await expect(ringi).toHaveAttribute('href', /screen=ringi.*partner=Yamuna/)
  })

  test('explains when the partner API is unreachable', async ({ page }) => {
    await page.route('**/api/v1/partners**', (route) => route.fulfill({ status: 500, body: '' }))
    await page.goto('/jig-os?screen=partners', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Partner data is read from Supabase', { exact: false })).toBeVisible()
  })
})

test('partner screen asks signed-out users to sign in', async ({ page }) => {
  await page.route('**/api/v1/partners**', (route) => route.fulfill({ status: 401, json: { detail: 'Not signed in' } }))
  await page.goto('/jig-os?screen=partners', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', /^\/login\?next=/)
})
