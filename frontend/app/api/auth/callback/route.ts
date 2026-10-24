import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  constantTimeEqual,
  exchangeCode,
  sessionCookieHeader,
} from '../../../../auth';

/**
 * Authorization Code callback. Verifies state, then exchanges the code for
 * tokens using the PKCE verifier that was stored at sign-in time.
 */

export async function GET(request: Request): Promise<NextResponse> {
  const base = new URL('/', request.url);
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const pending = await cookies();
  const expectedState = pending.get('kizuna_state')?.value ?? '';
  const verifier = pending.get('kizuna_pkce')?.value ?? '';
  pending.delete('kizuna_state');
  pending.delete('kizuna_pkce');

  if (error) return failure(`Sign-in was rejected: ${error}`, base);
  if (!code || !verifier) return failure('Sign-in session expired; try again.', base);
  if (!expectedState || !state || !constantTimeEqual(state, expectedState)) {
    return failure('State mismatch; sign-in request was not initiated by this site.', base);
  }

  try {
    const tokens = await exchangeCode(code, verifier);
    const response = NextResponse.redirect(base);
    response.headers.append('Set-Cookie', sessionCookieHeader(tokens));
    return response;
  } catch {
    return failure('Token exchange failed. Check the OIDC client is configured.', base);
  }
}

function failure(message: string, base: URL): NextResponse {
  const destination = new URL(base);
  destination.searchParams.set('auth_error', message);
  return NextResponse.redirect(destination);
}
