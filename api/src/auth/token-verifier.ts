import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';

export interface VerifiedToken {
  sub: string;
  username: string;
  groups: string[];
  /** Issued-at, seconds since epoch. */
  iat: number;
  exp: number;
}

export class TokenError extends Error {
  constructor(
    public readonly reason: 'missing' | 'expired' | 'invalid',
    message: string,
  ) {
    super(message);
  }
}

export abstract class TokenVerifier {
  abstract verify(token: string): Promise<VerifiedToken>;
}

interface CognitoClaims extends JWTPayload {
  token_use?: string;
  client_id?: string;
  username?: string;
  'cognito:groups'?: string[];
}

/**
 * Verifies Cognito *access* tokens: signature against the pool's JWKS, issuer,
 * expiry, token_use = "access" and an allowed app client.
 */
export class CognitoTokenVerifier extends TokenVerifier {
  private readonly keys: JWTVerifyGetKey;

  constructor(
    private readonly issuer: string,
    private readonly clientIds: string[],
    keys?: JWTVerifyGetKey,
    jwksUrl?: string,
  ) {
    super();
    this.keys = keys ?? createRemoteJWKSet(new URL(jwksUrl ?? `${issuer}/.well-known/jwks.json`));
  }

  async verify(token: string): Promise<VerifiedToken> {
    if (!token) throw new TokenError('missing', 'no bearer token');
    let payload: CognitoClaims;
    try {
      ({ payload } = await jwtVerify<CognitoClaims>(token, this.keys, { issuer: this.issuer }));
    } catch (err) {
      if (err instanceof errors.JWTExpired) throw new TokenError('expired', 'token expired');
      throw new TokenError('invalid', 'token signature or claims invalid');
    }
    if (payload.token_use !== 'access') throw new TokenError('invalid', 'not an access token');
    if (!payload.client_id || !this.clientIds.includes(payload.client_id)) {
      throw new TokenError('invalid', 'unknown app client');
    }
    if (!payload.sub || !payload.username || !payload.iat || !payload.exp) {
      throw new TokenError('invalid', 'token missing required claims');
    }
    return {
      sub: payload.sub,
      username: payload.username.toLowerCase(),
      groups: payload['cognito:groups'] ?? [],
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}
