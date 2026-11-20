import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentError } from './types';
type Purpose = 'onboarding' | 'cancel';
function signature(payload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update('marketplace-flow:v1:' + payload).digest();
}
export function signFlowToken(purpose: Purpose, subject: string, secret: string, now = Date.now(), ttlSeconds = 7200): string {
  const payload = Buffer.from(JSON.stringify({ v: 1, purpose, subject, exp: now + ttlSeconds * 1000 })).toString('base64url');
  return payload + '.' + signature(payload, secret).toString('base64url');
}
export function readFlowToken(token: string, purpose: Purpose, secret: string, now = Date.now()): string {
  const invalid = () => new PaymentError('This link has expired or is invalid. Start again.', 400, 'invalid_link');
  if (token.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw invalid();
  const [payload, provided] = token.split('.');
  const expected = signature(payload, secret);
  const actual = Buffer.from(provided, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw invalid();
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.v !== 1 || data.purpose !== purpose || typeof data.subject !== 'string' || !data.subject ||
        !Number.isFinite(data.exp) || data.exp <= now) throw invalid();
    return data.subject;
  } catch { throw invalid(); }
}
