/**
 * Browser-side API client.
 *
 * Requests go to the same-origin BFF proxy (app/api/v1/[...]), which reads the
 * sealed session cookie and attaches the bearer token server-side, so no token
 * is ever exposed to client JavaScript.
 *
 * Set NEXT_PUBLIC_API_BASE_URL to an absolute origin (e.g.
 * http://localhost:8000/api/v1) to talk to the API directly instead.
 */

const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1'

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (response.status === 401) throw new Error('Not signed in. Use “Sign in” and retry.')
  if (!response.ok) throw new Error(await response.text())
  return (await response.json()) as T
}
