import { forward } from '../../../../../lib/server/bff'

/** GET /api/v1/partners/{id}?assessment_id=… — assessment-scoped scorecard, still served by FastAPI. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return forward(request, ['partners', id], new URL(request.url).search)
}
