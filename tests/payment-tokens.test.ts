import test from 'node:test';
import assert from 'node:assert/strict';
import { signFlowToken, readFlowToken, createOrderProof, verifyOrderProof } from '../lib/payments/tokens';
const secret = 'test-signing-secret-only-for-unit-tests';

test('flow tokens return their bound subject for the correct purpose', () => {
  const token = signFlowToken('onboarding', 'acct_own', secret, 1000, 60);
  assert.equal(readFlowToken(token, 'onboarding', secret, 2000), 'acct_own');
});

test('order metadata proof binds amount, fee, account and order to this app secret', () => {
  const order = { id:'order-own',stripe_account_id:'acct_own',amount_cents:7000,fee_cents:700,currency:'usd' as const };
  const proof=createOrderProof(order,secret);
  assert.equal(verifyOrderProof(proof,order,secret),true);
  assert.equal(verifyOrderProof(proof,{...order,amount_cents:1},secret),false);
  assert.equal(verifyOrderProof(proof,order,'someone-elses-secret'),false);
});
test('flow tokens reject tampering, a different key, wrong purpose, and expiration', () => {
  const token = signFlowToken('cancel', 'own-order', secret, 1000, 60);
  assert.throws(() => readFlowToken(token + 'a', 'cancel', secret, 2000));
  assert.throws(() => readFlowToken(token, 'cancel', secret + 'other', 2000));
  assert.throws(() => readFlowToken(token, 'onboarding', secret, 2000));
  assert.throws(() => readFlowToken(token, 'cancel', secret, 61000));
  assert.throws(() => readFlowToken('invalid', 'cancel', secret, 2000));
});
