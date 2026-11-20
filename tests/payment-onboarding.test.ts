import test from 'node:test';
import assert from 'node:assert/strict';
import { beginOnboarding, finishOnboarding, refreshOnboarding } from '../lib/payments/onboarding';
import { signFlowToken } from '../lib/payments/tokens';
import { fakeContext } from './helpers/payment-fakes';
test('onboarding normalizes email, saves an account and returns a hosted link',async()=>{
  const ctx=fakeContext();ctx.repo.seller=null;
  const result=await beginOnboarding(' Seller@Example.COM ',ctx);
  assert.match(result.url,/^https:\/\/connect.stripe.com/);assert.equal(ctx.repo.seller!.email,'seller@example.com');
  assert.deepEqual(ctx.gateway.createdEmails,['seller@example.com']);
});
test('restarting onboarding reuses the known account',async()=>{
  const ctx=fakeContext();await beginOnboarding('seller@example.com',ctx);assert.equal(ctx.gateway.createdEmails.length,0);
});
test('onboarding return checks fresh Stripe readiness, not a URL success flag',async()=>{
  const ctx=fakeContext();ctx.gateway.account.payouts_enabled=false;
  const token=signFlowToken('onboarding','acct_testOwn',ctx.secret);
  const result=await finishOnboarding(token,ctx);assert.equal(result.ready,false);assert.equal(ctx.repo.seller!.payouts_enabled,false);
  assert.match((await refreshOnboarding(token,ctx)).url,/connect.stripe.com/);
  await assert.rejects(()=>finishOnboarding(token+'x',ctx));
});
test('a valid flow token cannot operate on an unknown shared-sandbox account',async()=>{
  const ctx=fakeContext();await assert.rejects(()=>finishOnboarding(signFlowToken('onboarding','acct_other',ctx.secret),ctx));
  assert.deepEqual(ctx.gateway.accountReads,[]);
});
