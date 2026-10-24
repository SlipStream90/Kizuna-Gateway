import { NextResponse } from 'next/server';

import { buildAuthorizationUrl } from '../../../../auth';

/**
 * Starts the Authorization Code + PKCE flow. The verifier, state and nonce
 * live in short-lived HttpOnly cookies so the callback can prove itself.
 */

export function GET(): NextResponse {
  const { url, cookies } = buildAuthorizationUrl();
  const response = NextResponse.redirect(url);
  for (const cookie of cookies) response.headers.append('Set-Cookie', cookie);
  return response;
}
