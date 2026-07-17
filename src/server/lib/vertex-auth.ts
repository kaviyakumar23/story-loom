import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadEnv, type Env } from '../config/env';
import { fetchWithTimeout } from './http';

/**
 * Vertex AI auth (§3, §7). Vertex — unlike the Gemini Developer API — has no
 * API key: every call carries an OAuth2 bearer token. We mint that token by
 * hand with `node:crypto`/`fetch` rather than pulling in `google-auth-library`,
 * keeping the provider layer SDK-free (the Inngest route is `nodejs`).
 *
 * Two credential kinds are supported, matching how developers actually set
 * Vertex up:
 *
 *  - `service_account` — a service-account key, provided inline via env
 *    (`GOOGLE_SERVICE_ACCOUNT_KEY`, raw or base64). Best for Vercel/CI, which
 *    have no writable filesystem for a key file. Token via the JWT-bearer grant.
 *  - `authorized_user` — Application Default Credentials from
 *    `gcloud auth application-default login`, read from the well-known ADC file.
 *    Best for local dev. Token via the refresh-token grant.
 *
 *  - Workload Identity Federation — keyless. A runtime OIDC token (e.g. Vercel's
 *    `VERCEL_OIDC_TOKEN`) is exchanged at Google STS for a federated token, then
 *    optionally used to impersonate a service account. This is the path for
 *    hosts where org policy forbids downloadable SA keys. Selected when
 *    `GOOGLE_WORKLOAD_IDENTITY_AUDIENCE` is set — it takes precedence over keys.
 *
 * Key/ADC resolution order: inline env key → `GOOGLE_APPLICATION_CREDENTIALS`
 * path → the ADC well-known file.
 */
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const STS_URL = 'https://sts.googleapis.com/v1/token';
const IAM_CREDENTIALS = 'https://iamcredentials.googleapis.com/v1';

interface ServiceAccount {
  type?: 'service_account';
  client_email: string;
  private_key: string;
  token_uri?: string;
  project_id?: string;
}
interface AuthorizedUser {
  type: 'authorized_user';
  client_id: string;
  client_secret: string;
  refresh_token: string;
  token_uri?: string;
  quota_project_id?: string;
}
type Credentials = ServiceAccount | AuthorizedUser;

let cachedCreds: Credentials | null = null;
let cachedToken: { token: string; expiresAt: number } | null = null;

function base64url(input: Buffer | string): string {
  return (Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8')).toString('base64url');
}

/** Well-known ADC path (honors CLOUDSDK_CONFIG); works on macOS + Linux/Vercel. */
function adcPath(): string {
  const configDir = process.env.CLOUDSDK_CONFIG || join(homedir(), '.config', 'gcloud');
  return join(configDir, 'application_default_credentials.json');
}

/** Turn a parsed credential object into a validated, discriminated Credentials. */
export function normalizeCredentials(obj: unknown): Credentials {
  const o = obj as Record<string, unknown>;
  if (o?.type === 'authorized_user') {
    if (!o.client_id || !o.client_secret || !o.refresh_token) {
      throw new Error('authorized_user credentials missing client_id/client_secret/refresh_token');
    }
    return o as unknown as AuthorizedUser;
  }
  if (!o?.client_email || !o?.private_key) {
    throw new Error('Google credentials are missing client_email/private_key (service account)');
  }
  return o as unknown as ServiceAccount;
}

/** Parse an inline credential string: raw JSON or base64-encoded JSON. */
export function parseInlineCredentials(raw: string): Credentials {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('empty credential string');
  const json = trimmed.startsWith('{') ? trimmed : Buffer.from(trimmed, 'base64').toString('utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON (or base64-encoded JSON)');
  }
  return normalizeCredentials(parsed);
}

function loadCredentials(): Credentials {
  if (cachedCreds) return cachedCreds;
  const inline = loadEnv().GOOGLE_SERVICE_ACCOUNT_KEY.trim();
  if (inline) {
    cachedCreds = parseInlineCredentials(inline);
    return cachedCreds;
  }
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS || adcPath();
  try {
    cachedCreds = normalizeCredentials(JSON.parse(readFileSync(path, 'utf8')));
    return cachedCreds;
  } catch (err) {
    throw new Error(
      'Vertex AI has no usable credentials. Either set GOOGLE_SERVICE_ACCOUNT_KEY, or run ' +
        `\`gcloud auth application-default login\` (looked at ${path}). Cause: ${(err as Error).message}`,
    );
  }
}

/** Project to address on Vertex: explicit env wins, else the one baked into ADC. */
export function resolveVertexProject(): string {
  const explicit = loadEnv().GOOGLE_CLOUD_PROJECT;
  if (explicit) return explicit;
  const creds = loadCredentials();
  const proj = creds.type === 'authorized_user' ? creds.quota_project_id : creds.project_id;
  if (!proj) {
    throw new Error('Set GOOGLE_CLOUD_PROJECT — no project id found in the Google credentials');
  }
  return proj;
}

/**
 * Signed JWT assertion for the jwt-bearer grant. Pure (clock is an argument) so
 * it can be unit-tested without the network.
 */
export function buildJwtAssertion(sa: ServiceAccount, nowSec: number): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: sa.token_uri || DEFAULT_TOKEN_URI,
      iat: nowSec,
      exp: nowSec + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${base64url(signer.sign(sa.private_key))}`;
}

/** x-www-form-urlencoded body for the refresh-token grant (pure/testable). */
export function buildRefreshTokenBody(user: AuthorizedUser): string {
  return new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: user.client_id,
    client_secret: user.client_secret,
    refresh_token: user.refresh_token,
  }).toString();
}

async function exchange(tokenUri: string, body: string): Promise<{ token: string; ttl: number }> {
  const res = await fetchWithTimeout(
    tokenUri,
    { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body },
    15_000,
  );
  if (!res.ok) {
    throw new Error(`Vertex AI token exchange failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('Vertex AI token exchange returned no access_token');
  return { token: data.access_token, ttl: data.expires_in ?? 3600 };
}

function buildJwtBearerBody(assertion: string): string {
  return new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  }).toString();
}

/** STS token-exchange body: trade an OIDC token for a federated Google token. */
export function buildStsExchangeBody(audience: string, subjectToken: string): string {
  return new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    audience,
    scope: SCOPE,
    requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    subject_token: subjectToken,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
  }).toString();
}

/** Key/ADC path: mint a token from a service account or authorized_user creds. */
async function mintCredentialToken(nowMs: number): Promise<{ token: string; ttl: number }> {
  const creds = loadCredentials();
  const tokenUri = creds.token_uri || DEFAULT_TOKEN_URI;
  return creds.type === 'authorized_user'
    ? exchange(tokenUri, buildRefreshTokenBody(creds))
    : exchange(tokenUri, buildJwtBearerBody(buildJwtAssertion(creds, Math.floor(nowMs / 1000))));
}

/** Keyless path: OIDC token -> STS federated token -> (optional) SA impersonation. */
async function mintFederatedToken(env: Env, nowMs: number): Promise<{ token: string; ttl: number }> {
  const tokenEnv = env.GOOGLE_SUBJECT_TOKEN_ENV || 'VERCEL_OIDC_TOKEN';
  const subjectToken = process.env[tokenEnv];
  if (!subjectToken) {
    throw new Error(
      `Vertex WIF: no OIDC token found in ${tokenEnv}. Enable OIDC federation ("Secure Backend ` +
        'Access") in the Vercel project settings so it injects the token at runtime.',
    );
  }

  const federated = await exchange(
    STS_URL,
    buildStsExchangeBody(env.GOOGLE_WORKLOAD_IDENTITY_AUDIENCE, subjectToken),
  );

  const saEmail = env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT;
  if (!saEmail) return federated; // direct federation — principal holds the role

  const res = await fetchWithTimeout(
    `${IAM_CREDENTIALS}/projects/-/serviceAccounts/${saEmail}:generateAccessToken`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${federated.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ scope: [SCOPE], lifetime: '3600s' }),
    },
    15_000,
  );
  if (!res.ok) {
    throw new Error(`Vertex WIF impersonation failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { accessToken?: string; expireTime?: string };
  if (!data.accessToken) throw new Error('Vertex WIF impersonation returned no accessToken');
  const ttl = data.expireTime
    ? Math.max(60, Math.floor((Date.parse(data.expireTime) - nowMs) / 1000))
    : 3600;
  return { token: data.accessToken, ttl };
}

/** A cloud-platform access token for Vertex, cached until ~5 min before expiry. */
export async function getVertexAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAt - 300_000) return cachedToken.token;

  const env = loadEnv();
  const { token, ttl } = env.GOOGLE_WORKLOAD_IDENTITY_AUDIENCE
    ? await mintFederatedToken(env, now)
    : await mintCredentialToken(now);

  cachedToken = { token, expiresAt: now + ttl * 1000 };
  return cachedToken.token;
}
