import { PaymentError, type Seller } from './types';

export function normalizeSellerEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PaymentError('Enter a valid seller email.');
  return email;
}
export function priceToCents(value: string | number, checkoutLimits = true): number {
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new PaymentError('This listing has an invalid price.');
  const [whole, fractional = ''] = text.split('.');
  const cents = Number(BigInt(whole) * BigInt(100) + BigInt(fractional.padEnd(2, '0')));
  if (!Number.isSafeInteger(cents) || cents < (checkoutLimits ? 50 : 1) || cents > (checkoutLimits ? 99999999 : 10000000000)) {
    throw new PaymentError(checkoutLimits ? 'Buy Now requires a USD price from $0.50 to $999,999.99.' : 'Invalid price.');
  }
  return cents;
}
export function platformFee(cents: number): number {
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new PaymentError('Invalid payment amount.');
  return Math.round(cents / 10);
}
export function sellerReady(seller: Pick<Seller, 'details_submitted' | 'charges_enabled' | 'payouts_enabled'> | null): boolean {
  return Boolean(seller?.details_submitted && seller.charges_enabled && seller.payouts_enabled);
}
export function requireTestSecret(secret: string): string {
  if (!secret.startsWith('sk_test_')) throw new PaymentError('Sandbox Stripe configuration is required.', 503, 'not_configured');
  return secret;
}
