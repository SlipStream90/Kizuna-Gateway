import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  decryptSession,
  refreshTokens,
  sessionCookieHeader,
} from '../../auth';

/**
 * BFF proxy: the browser calls this same-origin route, this attaches the
 * bearer token from the sealed session, and forwards to the API. The access
 * token never reaches client JavaScript.
 *
 * With NO session (no IdP running), and DEV_AUTH_FALLBACK=1, it mints a dev
 * token from the backend instead — the pre-OIDC behaviour kept on purpose.
 */

const ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:8000';
const DEV_FALLBACK = process.env.DEV_AUTH_FALLBACK === '1';

let devToken: { value: string; expiresAt: number } | null = null;

async function devAccessToken(): Promise<string | null> {
  if (!DEV_FALLBACK) return null;
  if (devToken && devToken.expiresAt - Date.now() > 5000) return devToken.value;
  try {
    const response = await fetch(`${ORIGIN}/api/v1/dev/session`, { method: 'POST' });
    if (!response.ok) return null;
    const body = (await response.json()) as { access_token: string; expires_in: number };
    devToken = {
      value: body.access_token,
      expiresAt: Date.now() + body.expires_in * 1000,
    };
    return devToken.value;
  } catch {
    return null;
  }
}

async function sessionAccessToken(): Promise<{ token: string; cookies: string[] } | null> {
  const pending = await cookies();
  const raw = pending.get('kizuna_session')?.value;
  if (!raw) return null;

  let tokens = decryptSession(raw);
  if (!tokens) return null;

  // Only rotate when the token is about to lapse, and carry a refreshed cookie
  // back so the browser session keeps working without a second round trip.
  if (tokens.expiresAt - Date.now() > 30_000) {
    return { token: tokens.accessToken, cookies: [] };
  }

  const rotated = await refreshTokens(tokens);
  if (!rotated) return { token: tokens.accessToken, cookies: [] };
  return { token: rotated.accessToken, cookies: [sessionCookieHeader(rotated)] };
}

export async function forward(request: Request, path: string[], search: string): Promise<NextResponse> {
  const session = await sessionAccessToken();
  const token = session?.token ?? (await devAccessToken());
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('cookie');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    headers.delete('Authorization');
  }

  const upstream = await fetch(`${ORIGIN}/api/v1/${path.join('/')}${search}`, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    // @ts-expect-error -- Node fetch runtime requires duplex for streaming bodies.
    duplex: 'half',
    cache: 'no-store',
  });

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });

  for (const header of session?.cookies ?? []) {
    response.headers.append('Set-Cookie', header);
  }

  return response;
}
