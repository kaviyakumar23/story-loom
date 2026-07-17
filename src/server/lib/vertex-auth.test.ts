import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildJwtAssertion,
  buildRefreshTokenBody,
  buildStsExchangeBody,
  normalizeCredentials,
  parseInlineCredentials,
} from './vertex-auth';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const SA = {
  type: 'service_account' as const,
  client_email: 'story-loom@example-proj.iam.gserviceaccount.com',
  private_key: PEM,
};
const USER = {
  type: 'authorized_user' as const,
  client_id: 'abc.apps.googleusercontent.com',
  client_secret: 'secret',
  refresh_token: '1//refresh',
};

function decodeSegment(seg: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(seg, 'base64url').toString('utf8'));
}

describe('normalizeCredentials', () => {
  it('accepts a service account', () => {
    const c = normalizeCredentials(SA);
    expect(c.type).toBe('service_account');
  });

  it('accepts an authorized_user (ADC)', () => {
    const c = normalizeCredentials(USER);
    expect(c.type).toBe('authorized_user');
  });

  it('rejects authorized_user missing a refresh token', () => {
    expect(() => normalizeCredentials({ type: 'authorized_user', client_id: 'x' })).toThrow(
      /refresh_token/,
    );
  });

  it('rejects a service account missing its private key', () => {
    expect(() => normalizeCredentials({ client_email: 'x' })).toThrow(/private_key/);
  });
});

describe('parseInlineCredentials', () => {
  it('accepts raw JSON and base64-encoded JSON alike', () => {
    const raw = parseInlineCredentials(JSON.stringify(SA));
    const b64 = parseInlineCredentials(Buffer.from(JSON.stringify(SA), 'utf8').toString('base64'));
    expect(raw).toMatchObject({ client_email: SA.client_email });
    expect(b64).toMatchObject({ client_email: SA.client_email });
  });

  it('rejects an empty string', () => {
    expect(() => parseInlineCredentials('   ')).toThrow(/empty/);
  });
});

describe('buildJwtAssertion', () => {
  it('produces a verifiable RS256 JWT with the cloud-platform scope', () => {
    const now = 1_700_000_000;
    const jwt = buildJwtAssertion(SA, now);
    const [header, claims, signature] = jwt.split('.');

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${header}.${claims}`);
    verifier.end();
    expect(verifier.verify(privateKey, Buffer.from(signature, 'base64url'))).toBe(true);

    expect(decodeSegment(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
    const payload = decodeSegment(claims);
    expect(payload.iss).toBe(SA.client_email);
    expect(payload.scope).toBe('https://www.googleapis.com/auth/cloud-platform');
    expect(payload.aud).toBe('https://oauth2.googleapis.com/token');
    expect(payload.iat).toBe(now);
    expect(payload.exp).toBe(now + 3600);
  });
});

describe('buildRefreshTokenBody', () => {
  it('encodes the refresh-token grant with the ADC client + refresh token', () => {
    const params = new URLSearchParams(buildRefreshTokenBody(USER));
    expect(params.get('grant_type')).toBe('refresh_token');
    expect(params.get('client_id')).toBe(USER.client_id);
    expect(params.get('client_secret')).toBe(USER.client_secret);
    expect(params.get('refresh_token')).toBe(USER.refresh_token);
  });
});

describe('buildStsExchangeBody', () => {
  it('encodes the token-exchange grant for Workload Identity Federation', () => {
    const audience =
      '//iam.googleapis.com/projects/328369479161/locations/global/workloadIdentityPools/vercel-pool/providers/vercel';
    const params = new URLSearchParams(buildStsExchangeBody(audience, 'the.oidc.token'));
    expect(params.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:token-exchange');
    expect(params.get('audience')).toBe(audience);
    expect(params.get('scope')).toBe('https://www.googleapis.com/auth/cloud-platform');
    expect(params.get('requested_token_type')).toBe('urn:ietf:params:oauth:token-type:access_token');
    expect(params.get('subject_token')).toBe('the.oidc.token');
    expect(params.get('subject_token_type')).toBe('urn:ietf:params:oauth:token-type:jwt');
  });
});
