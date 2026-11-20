import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSellerEmail, priceToCents, platformFee, sellerReady, requireTestSecret } from '../lib/payments/policy';

test('seller email matching trims and normalizes case', () => {
  assert.equal(normalizeSellerEmail(' Seller@Example.COM '), 'seller@example.com');
  assert.throws(() => normalizeSellerEmail('not-email'), /email/i);
});
test('prices convert to exact USD cents and reject invalid Checkout amounts', () => {
  assert.equal(priceToCents('70.00'), 7000);
  assert.equal(priceToCents(0.50), 50);
  assert.equal(priceToCents('0.29', false), 29);
  assert.equal(priceToCents('100000000.00', false), 10000000000);
  assert.equal(priceToCents('999999.99'), 99999999);
  for (const price of ['0', '-1', '1.005', 'NaN', '1e3', '1000000', '100000001', '0.49']) assert.throws(() => priceToCents(price));
});
test('application fee is 10 percent rounded to the nearest cent', () => {
  assert.equal(platformFee(7000), 700);
  assert.equal(platformFee(55), 6);
  assert.throws(() => platformFee(-10));
});
test('a seller must have completed details and enabled charges and payouts', () => {
  const ready = { details_submitted: true, charges_enabled: true, payouts_enabled: true };
  assert.equal(sellerReady(ready), true);
  assert.equal(sellerReady({ ...ready, payouts_enabled: false }), false);
  assert.equal(sellerReady({ ...ready, charges_enabled: false }), false);
  assert.equal(sellerReady(null), false);
});
test('only sandbox secret keys are accepted', () => {
  assert.equal(requireTestSecret('sk_test_example'), 'sk_test_example');
  assert.throws(() => requireTestSecret('sk_live_example'), /sandbox/i);
  assert.throws(() => requireTestSecret(''), /sandbox/i);
});
