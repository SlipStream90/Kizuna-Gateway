import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { decryptSession, refreshTokens } from '../../../../auth';

/**
 * Read-only view of the current session for the browser chrome.
 *
 * It deliberately exposes only non-sensitive labels (name, roles, expiry) â€”
 * tokens stay in the HttpOnly cookie and are never serialised here.
 */

export async function GET(): Promise<NextResponse> {
  const pending = await cookies();
  const raw = pending.get('kizuna_session')?.value;
  if (!raw) return NextResponse.json({ authenticated: false });

  let tokens = decryptSession(raw);
  if (tokens && tokens.expiresAt - Date.now() < 30_000) {
    tokens = await refreshTokens(tokens);
  }
  if (!tokens) return NextResponse.json({ authenticated: false });

  return NextResponse.json({
    authenticated: true,
    user: tokens.user,
    orgId: tokens.orgId,
    roles: tokens.roles,
    expiresAt: tokens.expiresAt,
  });
}
