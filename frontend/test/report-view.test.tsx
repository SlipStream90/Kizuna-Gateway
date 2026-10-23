import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReportView } from '../components/report-view'

describe('ReportView', () => it('renders a structured, printable report without raw JSON', () => {
  const { container } = render(<ReportView report={{ formula_version: 'mcda-v1', data_version: 'seed-1', payload: { assessment: { product: 'Sensor', sector: 'Industrial', target_customer: 'OEM' }, ranking: { rows: [{ region_id: 'mh', rank: 1, name: 'Maharashtra', score: '0.8', coverage: '0.9', source_ids: ['src-1'], warnings: ['check'] }] }, partners: [{ id: 'p1', name: 'Demo Partner', fictional: true, fit: { channel: 'high' }, evidence: { source: 'src-1' }, disclosure: 'Fictional fixture', coverage: '0.8', verification_state: 'unreviewed', missing_checks: ['identity'] }], compliance_checklist: { items: [{ item: 'Certification', applicability: 'uncertain', review_required: true, citation: { source_id: 'src-1', passage: 'Stored citation' } }] }, sources: [{ id: 'src-1', authority: 'Authority', canonical_url: 'https://example.test', checked_at: 'today' }], gtm: [{ direct: { total: '100', line_items: [{ label: 'Goods', amount: '80' }] }, distributor: { total: '120', line_items: [{ label: 'Margin', amount: '20' }] }, sensitivity_field: 'shipping_cost', sensitivity: { direct_delta: '2' }, comparison: { difference: '20' }, assumptions: { tax: 'illustrative' } }], assumptions: ['offline'], risks: ['verify'], next_steps: ['review'] } }} />)
  for (const label of ['Market rankings', 'Fictional partner evidence', 'Compliance checklist and source references', 'GTM scenarios and assumptions', 'Risks and next steps', 'Maharashtra', 'Fictional fixture', 'Stored citation', 'Goods', 'Margin', 'mcda-v1', 'verify', 'review']) expect(screen.getByText(label)).toBeTruthy()
  expect(container.textContent).not.toContain('{"channel"')
  expect(container.querySelector('.overflow-x-auto')).toBeTruthy()
  expect(container.querySelector('.print\\:break-inside-avoid')).toBeTruthy()
}))
