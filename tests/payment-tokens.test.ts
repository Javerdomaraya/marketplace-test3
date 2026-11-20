import test from 'node:test';
import assert from 'node:assert/strict';
import { signFlowToken, readFlowToken } from '../lib/payments/tokens';
const secret = 'test-signing-secret-only-for-unit-tests';

test('flow tokens return their bound subject for the correct purpose', () => {
  const token = signFlowToken('onboarding', 'acct_own', secret, 1000, 60);
  assert.equal(readFlowToken(token, 'onboarding', secret, 2000), 'acct_own');
});
test('flow tokens reject tampering, a different key, wrong purpose, and expiration', () => {
  const token = signFlowToken('cancel', 'own-order', secret, 1000, 60);
  assert.throws(() => readFlowToken(token + 'a', 'cancel', secret, 2000));
  assert.throws(() => readFlowToken(token, 'cancel', secret + 'other', 2000));
  assert.throws(() => readFlowToken(token, 'onboarding', secret, 2000));
  assert.throws(() => readFlowToken(token, 'cancel', secret, 61000));
  assert.throws(() => readFlowToken('invalid', 'cancel', secret, 2000));
});
