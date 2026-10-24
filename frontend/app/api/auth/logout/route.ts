import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { logoutUrl } from '../../../../auth';

/**
 * Clears the sealed session cookie, then hands the browser to the provider's
 * end-session endpoint so the IdP session is ended too.
 */

export function GET(): NextResponse {
  const response = NextResponse.redirect(logoutUrl());
  response.cookies.delete('kizuna_session');
  response.cookies.delete('kizuna_pkce');
  response.cookies.delete('kizuna_state');
  response.cookies.delete('kizuna_nonce');
  return response;
}
