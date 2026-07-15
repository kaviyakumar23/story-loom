import { createHash, timingSafeEqual } from 'node:crypto';
import { loadEnv } from '../config/env';
import { forbidden } from './errors';

const COOKIE_NAME = 'plumtale_beta_access';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function betaAccessStatus(req: Request): { enabled: boolean; granted: boolean } {
  const enabled = betaAccessEnabled();
  return { enabled, granted: !enabled || hasValidAccessCookie(req) };
}

export function assertBetaAccess(req: Request): void {
  const status = betaAccessStatus(req);
  if (!status.granted) throw forbidden('Enter your beta invite code to create a preview.');
}

export function isValidBetaCode(code: string): boolean {
  const expected = accessToken();
  if (!expected) return true;
  const actual = hash(code.trim());
  return equalHash(actual, expected);
}

export function betaAccessCookie(): string {
  const token = accessToken();
  const secure = loadEnv().NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SECONDS}${secure}`;
}

function betaAccessEnabled(): boolean {
  return Boolean(loadEnv().BETA_ACCESS_CODE.trim());
}

function hasValidAccessCookie(req: Request): boolean {
  const expected = accessToken();
  if (!expected) return true;
  const actual = cookieValue(req.headers.get('cookie'), COOKIE_NAME);
  return Boolean(actual && equalHash(actual, expected));
}

function accessToken(): string {
  const code = loadEnv().BETA_ACCESS_CODE.trim();
  return code ? hash(code) : '';
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function equalHash(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName === name) return rawValue.join('=') || null;
  }
  return null;
}
