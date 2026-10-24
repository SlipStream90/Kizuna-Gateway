'use client'

type Data = Record<string, unknown>
type Report = { label?: string; formula_version?: string; data_version?: string; created_at?: string; payload?: Data }
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const fields = (value: unknown): [string, unknown][] => value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value as Data) : []
const text = (value: unknown) => value === undefined || value === null || value === '' ? 'Not available' : String(value)
const FieldList = ({ value }: { value: unknown }) => <ul className="text-xs text-sumi/60 space-y-1">{fields(value).map(([name, item]) => <li key={name} className="flex justify-between"><span className="text-sumi/50">{name.replaceAll('_', ' ')}:</span> <span className="font-mono text-sumi">{text(item)}</span></li>)}</ul>

export function ReportView({ report }: { report: Report }) {
  const p: Data = report.payload ?? report
  const assessment = (p.assessment ?? {}) as Data
  return (
    <section role="region" aria-label="Consolidated market-entry report" className="glass-panel p-6 rounded-2xl space-y-6 print:text-black">
      <header className="report-header border-b border-aijiro/20 pb-4">
        <p className="eyebrow mb-2">Offline Consolidated Report</p>
        <h2 className="text-2xl font-bold text-sumi mb-2">India Market-Entry Recommendation</h2>
        <p className="text-sumi/60 text-sm">{report.label ?? 'Cached illustrative offline report'} — all compliance and partner data requires human verification.</p>
        <dl className="report-meta grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div className="p-3 rounded-lg bg-washi/40 border border-hairline">
            <dt className="text-[10px] uppercase tracking-wider text-sumi/50 font-bold">Generated</dt>
            <dd className="font-mono text-sm text-sumi">{text(report.created_at ?? p.generated_at)}</dd>
          </div>
          <div className="p-3 rounded-lg bg-washi/40 border border-hairline">
            <dt className="text-[10px] uppercase tracking-wider text-sumi/50 font-bold">Formula Version</dt>
            <dd className="font-mono text-sm text-sumi">{text(report.formula_version ?? p.formula_version)}</dd>
          </div>
          <div className="p-3 rounded-lg bg-washi/40 border border-hairline">
            <dt className="text-[10px] uppercase tracking-wider text-sumi/50 font-bold">Data Version</dt>
            <dd className="font-mono text-sm text-sumi">{text(report.data_version ?? p.data_version)}</dd>
          </div>
        </dl>
      </header>

      <section className="space-y-4">
        <h3 className="jp-heading text-lg text-sumi">Assessment Intake</h3>
        <dl className="report-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-washi/40 border border-hairline">
            <dt className="text-[10px] uppercase tracking-wider text-sumi/50 font-bold">Product</dt>
            <dd className="font-mono text-sm text-sumi">{text(assessment.product)}</dd>
          </div>
          <div className="p-3 rounded-lg bg-washi/40 border border-hairline">
            <dt className="text-[10px] uppercase tracking-wider text-sumi/50 font-bold">Sector</dt>
            <dd className="font-mono text-sm text-sumi">{text(assessment.sector)}</dd>
          </div>
          <div className="p-3 rounded-lg bg-washi/40 border border-hairline">
            <dt className="text-[10px] uppercase tracking-wider text-sumi/50 font-bold">Target Customer</dt>
            <dd className="font-mono text-sm text-sumi">{text(assessment.target_customer)}</dd>
          </div>
          <div className="p-3 rounded-lg bg-washi/40 border border-hairline">
            <dt className="text-[10px] uppercase tracking-wider text-sumi/50 font-bold">HS Code</dt>
            <dd className="font-mono text-sm text-sumi">{text(assessment.hs_code ?? 'Unresolved — verify classification')}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-4">
        <h3 className="jp-heading text-lg text-sumi">Market rankings</h3>
        <div className="table-scroll overflow-x-auto print:overflow-visible">
          <table className="w-full text-left border-collapse print:break-inside-avoid">
            <thead>
              <tr className="border-b border-aijiro/20">
                <th className="pb-2 text-[10px] uppercase tracking-wider text-sumi/50 font-bold">Rank</th>
                <th className="pb-2 text-[10px] uppercase tracking-wider text-sumi/50 font-bold">Region</th>
                <th className="pb-2 text-[10px] uppercase tracking-wider text-sumi/50 font-bold">Score</th>
                <th className="pb-2 text-[10px] uppercase tracking-wider text-sumi/50 font-bold">Coverage</th>
                <th className="pb-2 text-[10px] uppercase tracking-wider text-sumi/50 font-bold">Sources and Warnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aijiro/10">
              {list((p.ranking as Data | undefined)?.rows).map((row, i) => {
                const r = row as Data
                return (
                  <tr key={text(r.region_id ?? i)} className="hover:bg-washi/30 transition-colors">
                    <td className="py-3 font-mono text-sm text-sumi">{text(r.rank)}</td>
                    <td className="py-3 font-medium text-sm text-sumi">{text(r.name)}</td>
                    <td className="py-3 font-mono text-sm text-aijiro font-bold">{text(r.score)}</td>
                    <td className="py-3 text-xs text-sumi/60">{text(r.coverage)}</td>
                    <td className="py-3 text-xs text-sumi/60">{list(r.source_ids).map(text).join(', ')} {list(r.warnings).map(text).join(' ')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="jp-heading text-lg text-sumi">Fictional partner evidence</h3>
        {list(p.partners).map((partner, i) => {
          const x = partner as Data
          return (
            <article key={text(x.id ?? i)} className="p-4 bg-washi/40 border border-hairline card-lift">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-sumi">{text(x.name)}</h4>
                <span className="text-[10px] uppercase tracking-wider text-akaneiro font-bold">Fictional: {text(x.fictional)}</span>
              </div>
              <p className="text-xs text-sumi/60 mb-3">Evidence coverage: {text(x.coverage)}. Verification: {text(x.verification_state)} ({text(x.verification_date)}).</p>
              <h5 className="text-xs font-bold text-sumi/70 uppercase tracking-wider mb-1">Operational Fit</h5>
              <FieldList value={x.fit} />
              <h5 className="text-xs font-bold text-sumi/70 uppercase tracking-wider mb-1 mt-3">Evidence</h5>
              <FieldList value={x.evidence} />
              <p className="text-[10px] text-sumi/50 mt-2">Disclosure: {text(x.disclosure ?? 'Illustrative record; verify before use.')}</p>
              <p className="text-xs text-sumi/60">Missing checks: {list(x.missing_checks).map(text).join(', ') || 'None listed'}</p>
            </article>
          )
        })}
      </section>

      <section className="space-y-4">
        <h3 className="jp-heading text-lg text-sumi">Compliance checklist and source references</h3>
        {list((p.compliance_checklist as Data | undefined)?.items).map((item, i) => {
          const x = item as Data
          const citation = (x.citation ?? {}) as Data
          return (
            <article key={text(citation.source_id ?? i)} className="p-4 bg-washi/40 border border-hairline card-lift">
              <h4 className="font-bold text-sumi mb-2">{text(x.item)}</h4>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-sumi/50 text-[10px] uppercase">Applicability</dt>
                  <dd className="text-sumi">{text(x.applicability)}</dd>
                </div>
                <div>
                  <dt className="text-sumi/50 text-[10px] uppercase">Review State</dt>
                  <dd className="text-sumi">Human review: {text(x.review_required ?? x.human_review_required)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-sumi/50 text-[10px] uppercase">Citation</dt>
                  <dd className="font-mono text-sumi">{text(citation.source_id)}; {text(citation.passage)}</dd>
                </div>
              </dl>
            </article>
          )
        })}
        <ul className="source-list space-y-2">
          {list(p.sources).map((source, i) => {
            const x = source as Data
            return (
              <li key={text(x.id ?? i)} className="p-2 rounded-lg bg-washi/30 border border-hairline">
                <a href={text(x.canonical_url)} className="text-xs text-aijiro underline break-all">{text(x.id)} — {text(x.authority)}</a>
                <p className="text-[10px] text-sumi/50">Checked {text(x.checked_at)}</p>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-4">
        <h3 className="jp-heading text-lg text-sumi">GTM scenarios and assumptions</h3>
        {list(p.gtm).map((scenario, i) => {
          const x = scenario as Data
          return (
            <article key={text(x.id ?? i)} className="p-4 bg-washi/40 border border-hairline card-lift">
              <h4 className="font-bold text-sumi mb-2">Two-Mode Comparison</h4>
              <p className="text-xs text-sumi/60 mb-3">Generated: {text(x.generated_at)}; Sensitivity: {text(x.sensitivity_field)}.</p>
              <div className="table-scroll overflow-x-auto print:overflow-visible">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-aijiro/20">
                      <th className="pb-2 text-sumi/50 text-[10px] uppercase">Mode</th>
                      <th className="pb-2 text-sumi/50 text-[10px] uppercase">Line Item</th>
                      <th className="pb-2 text-sumi/50 text-[10px] uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aijiro/10">
                    {(['direct', 'distributor'] as const).flatMap((mode) => {
                      const result = (x[mode] ?? {}) as Data
                      const lines = list(result.line_items)
                      return lines.length
                        ? lines.map((line, j) => {
                            const y = line as Data
                            return (
                              <tr key={`${mode}-${j}`}>
                                <td className="py-2 font-medium text-sumi">{mode}</td>
                                <td className="py-2 text-sumi">{text(y.label)}</td>
                                <td className="py-2 font-mono text-aijiro">{text(y.amount)}</td>
                              </tr>
                            )
                          })
                        : [<tr key={mode}><td className="py-2 font-medium text-sumi">{mode}</td><td className="py-2 text-sumi">Total</td><td className="py-2 font-mono text-aijiro">{text(result.total)}</td></tr>]
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-aijiro/20">
                      <th className="pt-2 text-sumi/50 text-[10px] uppercase" colSpan={2}>Direct Total</th>
                      <td className="pt-2 font-mono text-aijiro font-bold">{text((x.direct as Data | undefined)?.total)}</td>
                    </tr>
                    <tr>
                      <th className="pt-2 text-sumi/50 text-[10px] uppercase" colSpan={2}>Distributor Total</th>
                      <td className="pt-2 font-mono text-akaneiro font-bold">{text((x.distributor as Data | undefined)?.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <h5 className="text-xs font-bold text-sumi/70 uppercase tracking-wider mb-1 mt-3">Sensitivity</h5>
              <FieldList value={x.sensitivity} />
              <h5 className="text-xs font-bold text-sumi/70 uppercase tracking-wider mb-1 mt-3">Comparison</h5>
              <FieldList value={x.comparison} />
              <h5 className="text-xs font-bold text-sumi/70 uppercase tracking-wider mb-1 mt-3">Assumptions</h5>
              <FieldList value={x.assumptions} />
            </article>
          )
        })}
        <h4 className="text-sm font-bold text-sumi mt-4">Report Assumptions</h4>
        <ul className="text-xs text-sumi/60 space-y-1">{list(p.assumptions).map((item, i) => <li key={i}>{text(item)}</li>)}</ul>
      </section>

      <section className="space-y-4 pt-4 border-t border-aijiro/20">
        <h3 className="jp-heading text-lg text-sumi">Risks and next steps</h3>
        <div className="report-grid grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-bold text-sumi mb-2">Risks</h4>
            <ul className="text-xs text-sumi/60 space-y-1 list-disc list-inside">{list(p.risks).map((item, i) => <li key={i}>{text(item)}</li>)}</ul>
          </div>
          <div>
            <h4 className="text-sm font-bold text-sumi mb-2">Next Steps</h4>
            <ol className="text-xs text-sumi/60 space-y-1 list-decimal list-inside">{list(p.next_steps).map((item, i) => <li key={i}>{text(item)}</li>)}</ol>
          </div>
        </div>
      </section>
    </section>
  )
}
