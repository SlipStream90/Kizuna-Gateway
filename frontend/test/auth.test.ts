import { describe, expect, it } from 'vitest'

/**
 * The session seal is the security boundary of the BFF proxy, so these tests
 * pin the round trip, tamper rejection and claim path helpers.
 */

const SECRET = '0123456789abcdef0123456789abcdef'

describe('session sealing', () => {
  it('round-trips tokens through the encrypted cookie value', async () => {
    process.env.AUTH_SESSION_SECRET = SECRET
    const { encryptSession, decryptSession } = await import('../auth')
    const tokens = {
      accessToken: 'access-value',
      refreshToken: 'refresh-value',
      expiresAt: Date.now() + 999_000,
      orgId: '11111111-1111-1111-1111-111111111111',
      user: 'demo@kizuna.example',
      roles: ['admin'],
    }
    expect(decryptSession(encryptSession(tokens))).toEqual(tokens)
  })

  it('refuses a tampered cookie body', async () => {
    process.env.AUTH_SESSION_SECRET = SECRET
    const { encryptSession, decryptSession } = await import('../auth')
    const sealed = encryptSession({
      accessToken: 'a',
      refreshToken: 'b',
      expiresAt: Date.now() + 999_000,
      orgId: 'org',
      user: 'user',
      roles: [],
    })
    const flipped = sealed.slice(0, -3) + 'aaa'
    expect(decryptSession(flipped)).toBeNull()
  })

  it('refuses a value sealed under a different secret', async () => {
    process.env.AUTH_SESSION_SECRET = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const auth = await import('../auth')
    const sealed = auth.encryptSession({
      accessToken: 'a',
      refreshToken: 'b',
      expiresAt: Date.now(),
      orgId: 'org',
      user: 'user',
      roles: [],
    })
    process.env.AUTH_SESSION_SECRET = SECRET
    expect(auth.decryptSession(sealed)).toBeNull()
  })
})

describe('claim resolution', () => {
  it('reads nested and array claim paths', async () => {
    const { claimPath, claimRoles, decodeClaims } = await import('../auth')
    const claims = {
      org_id: 'org-1',
      roles: ['member', 'reviewer'],
      realm_access: { roles: ['admin'] },
    }
    expect(claimPath(claims, 'org_id')).toBe('org-1')
    expect(claimPath(claims, 'realm_access.roles')).toEqual(['admin'])
    expect(claimPath(claims, 'missing.path')).toBeUndefined()
    expect(claimRoles(claims, 'roles')).toEqual(['member', 'reviewer'])
    expect(claimRoles(claims, 'realm_access.roles')).toEqual(['admin'])

    const token = Buffer.from(JSON.stringify({ header: true })).toString('base64url')
      + '.'
      + Buffer.from(JSON.stringify(claims)).toString('base64url')
    expect(decodeClaims(token).roles).toEqual(['member', 'reviewer'])
  })
})

describe('state comparison', () => {
  it('rejects differing state values', async () => {
    const { constantTimeEqual } = await import('../auth')
    expect(constantTimeEqual('state-abc', 'state-abc')).toBe(true)
    expect(constantTimeEqual('state-abc', 'state-abd')).toBe(false)
  })
})
