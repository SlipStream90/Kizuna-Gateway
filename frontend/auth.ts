import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Authorization Code + PKCE against an OIDC provider (Keycloak by default).
 *
 * The browser never receives an access token: the resulting tokens are sealed
 * into an encrypted, HttpOnly session cookie, and every /api/v1 request is
 * proxied server-side by app/api/v1/[...], which reads that cookie.
 */

const ISSUER = process.env.OIDC_ISSUER ?? 'http://localhost:8080/realms/kizuna';
const CLIENT_ID = process.env.OIDC_CLIENT_ID ?? 'kizuna-web';
const CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET ?? 'dev-secret';
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const ORG_CLAIM = process.env.OIDC_ORG_CLAIM ?? 'org_id';
const ROLES_CLAIM = process.env.OIDC_ROLES_CLAIM ?? 'roles';

const TOKEN_URL = `${ISSUER}/protocol/openid-connect/token`;
const AUTHZ_URL = `${ISSUER}/protocol/openid-connect/auth`;
const END_SESSION_URL = `${ISSUER}/protocol/openid-connect/logout`;

const SESSION_COOKIE = 'kizuna_session';
const SESSION_MAX_AGE = 60 * 60 * 8;
const SHORT_MAX_AGE = 600;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  orgId: string;
  user: string;
  roles: string[];
}

function secureCookie(): boolean {
  return process.env.COOKIE_SECURE === '1';
}

function cookieAttributes(maxAge: number): string {
  return `HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secureCookie() ? '; Secure' : ''}`;
}

export function requireSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET ?? '';
  if (secret.length < 32) {
    throw new Error('AUTH_SESSION_SECRET must be at least 32 characters');
  }
  return secret;
}

/* ------------------------------------------------------------------ */
/* Sealed session value                                                */
/* ------------------------------------------------------------------ */

export function encryptSession(tokens: SessionTokens): string {
  const key = Buffer.from(requireSessionSecret(), 'utf8').subarray(0, 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

export function decryptSession(value: string): SessionTokens | null {
  try {
    const box = Buffer.from(value, 'base64url');
    if (box.length < 28) return null;
    const key = Buffer.from(requireSessionSecret(), 'utf8').subarray(0, 32);
    const decipher = createDecipheriv('aes-256-gcm', key, box.subarray(0, 12));
    decipher.setAuthTag(box.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(box.subarray(28)), decipher.final()]);
    const parsed = JSON.parse(plain.toString('utf8')) as SessionTokens;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Authorization Code + PKCE                                            */
/* ------------------------------------------------------------------ */

function frontendUrl(path: string): string {
  return `${APP_URL.replace(/\/+$/, '')}${path}`;
}

export function buildAuthorizationUrl(): { url: string; cookies: string[] } {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  const nonce = randomUUID();
  const state = randomUUID();

  const url = new URL(AUTHZ_URL);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile email roles');
  url.searchParams.set('redirect_uri', frontendUrl('/api/auth/callback'));
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);

  const attributes = cookieAttributes(SHORT_MAX_AGE);
  const cookies = [
    `kizuna_pkce=${codeVerifier}; ${attributes}`,
    `kizuna_state=${state}; ${attributes}`,
    `kizuna_nonce=${nonce}; ${attributes}`,
  ];

  return { url: url.toString(), cookies };
}

export async function exchangeCode(code: string, verifier: string): Promise<SessionTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: frontendUrl('/api/auth/callback'),
    code_verifier: verifier,
  });
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new Error('Token exchange failed');
  return toSession(await response.json());
}

export async function refreshTokens(tokens: SessionTokens): Promise<SessionTokens | null> {
  if (!tokens.refreshToken) return null;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: tokens.refreshToken,
  });
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) return null;
    return toSession(await response.json());
  } catch {
    return null;
  }
}

function toSession(tokens: Record<string, unknown>): SessionTokens {
  if (typeof tokens.access_token !== 'string' || typeof tokens.refresh_token !== 'string') {
    throw new Error('Token response was incomplete');
  }
  const claims = decodeClaims(tokens.access_token);
  const idClaims = typeof tokens.id_token === 'string' ? decodeClaims(tokens.id_token) : {};
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + Number(tokens.expires_in ?? 300) * 1000,
    orgId: String(claimPath(idClaims, ORG_CLAIM) ?? claimPath(claims, ORG_CLAIM) ?? ''),
    user: String(idClaims.email ?? idClaims.preferred_username ?? 'user'),
    roles: claimRoles(claims, ROLES_CLAIM),
  };
}

/* ------------------------------------------------------------------ */
/* Claim helpers                                                        */
/* ------------------------------------------------------------------ */

export function decodeClaims(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1];
    if (!payload) return {};
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof claims === 'object' && claims !== null ? claims : {};
  } catch {
    return {};
  }
}

export function claimPath(claims: Record<string, unknown>, path: string): unknown {
  let value: unknown = claims;
  for (const part of path.split(/[.[\]]/).filter(Boolean)) {
    if (typeof value !== 'object' || value === null) return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

export function claimRoles(claims: Record<string, unknown>, path: string): string[] {
  const value = claimPath(claims, path);
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string');
  return typeof value === 'string' ? [value] : [];
}

export function constantTimeEqual(a: string, b: string): boolean {
  const first = Buffer.from(a, 'utf8');
  const second = Buffer.from(b, 'utf8');
  if (first.length !== second.length) return false;
  return timingSafeEqual(first, second);
}

export function sessionCookieHeader(tokens: SessionTokens): string {
  return `${SESSION_COOKIE}=${encryptSession(tokens)}; ${cookieAttributes(SESSION_MAX_AGE)}`;
}

export function logoutUrl(): string {
  const url = new URL(END_SESSION_URL);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('post_logout_redirect_uri', frontendUrl('/'));
  return url.toString();
}
