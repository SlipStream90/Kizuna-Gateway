const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1'

// Local demos have no OIDC provider, so the backend can mint a short-lived
// token from POST /dev/session (it is inert unless DEV_AUTH_ENABLED=1). Set
// NEXT_PUBLIC_DEV_AUTH=0 in a deployment that issues real tokens instead.
const devAuthEnabled = process.env.NEXT_PUBLIC_DEV_AUTH !== '0'

type CachedToken = { value: string; expiresAt: number }

let cachedToken: CachedToken | null = null
let inFlight: Promise<string | null> | null = null

async function requestDevToken(): Promise<CachedToken | null> {
  try {
    const response = await fetch(`${base}/dev/session`, { method: 'POST' })
    if (!response.ok) return null
    const body = (await response.json()) as { access_token: string; expires_in: number }
    return { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 }
  } catch {
    // Backend unreachable or dev sessions disabled: send the request as-is so
    // the caller sees the real 401 instead of a token failure.
    return null
  }
}

async function bearerToken(force = false): Promise<string | null> {
  if (!devAuthEnabled) return null
  if (!force && cachedToken && cachedToken.expiresAt - Date.now() > 5000) return cachedToken.value
  if (!inFlight) {
    inFlight = requestDevToken().then(
      (next) => {
        cachedToken = next
        inFlight = null
        return next?.value ?? null
      },
      () => {
        inFlight = null
        return null
      },
    )
  }
  return inFlight
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const send = async (token: string | null): Promise<Response> => {
    const headers = new Headers(init?.headers)
    headers.set('Content-Type', 'application/json')
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(`${base}${path}`, { ...init, headers })
  }

  let response = await send(await bearerToken())
  if (response.status === 401) {
    // The cached token may have expired or the backend may have restarted.
    response = await send(await bearerToken(true))
  }
  if (!response.ok) throw new Error(await response.text())
  return (await response.json()) as T
}
