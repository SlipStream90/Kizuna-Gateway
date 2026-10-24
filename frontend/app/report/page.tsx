import { Workflow } from '../../components/workflow'
export default function ReportPage() {
  return (
    <section className="py-12 px-4 text-center max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-sumi mb-4">Report Workflow</h1>
      <p className="text-sumi/60 mb-8">Generate a saved assessment then render its cached illustrative report.</p>
      <Workflow />
    </section>
  )
}
