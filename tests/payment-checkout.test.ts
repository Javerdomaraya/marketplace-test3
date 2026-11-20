import test from 'node:test';
import assert from 'node:assert/strict';
import { createCheckout, cancelCheckout, getOrderReceipt } from '../lib/payments/checkout';
import { signFlowToken } from '../lib/payments/tokens';
import { fakeContext, pendingOrder, listingId, orderId } from './helpers/payment-fakes';
test('Checkout uses the reserved database amount, application fee, and connected account',async()=>{
  const ctx=fakeContext(); const result=await createCheckout(listingId,ctx,orderId);
  assert.equal(result.url,'https://checkout.stripe.com/test');
  const spec=ctx.gateway.specs[0]; assert.equal(spec.order.amount_cents,7000); assert.equal(spec.order.fee_cents,700);
  assert.equal(spec.order.stripe_account_id,'acct_testOwn'); assert.match(spec.successUrl,/session_id=\{CHECKOUT_SESSION_ID\}/);
  assert.equal(ctx.repo.listing.status,'reserved'); assert.equal(ctx.repo.order!.stripe_checkout_session_id,'cs_test_own');
});
test('sold, reserved, unknown, and unready listings cannot start Checkout',async()=>{
  for(const status of ['sold','reserved'] as const){const ctx=fakeContext();ctx.repo.listing.status=status;await assert.rejects(()=>createCheckout(listingId,ctx));assert.equal(ctx.gateway.specs.length,0);}
  const ctx=fakeContext();ctx.gateway.account.payouts_enabled=false;await assert.rejects(()=>createCheckout(listingId,ctx),/seller/i);
  assert.equal(ctx.repo.listing.status,'available');assert.equal(ctx.gateway.specs.length,0);
});
test('provider creation failure releases the reservation',async()=>{
  const ctx=fakeContext();ctx.gateway.createFails=true;
  await assert.rejects(()=>createCheckout(listingId,ctx));
  assert.equal(ctx.repo.listing.status,'available');assert.equal(ctx.repo.order!.status,'expired');
});
test('failed session persistence expires Stripe before releasing the reservation',async()=>{
  const ctx=fakeContext();ctx.repo.attachFails=true;
  await assert.rejects(()=>createCheckout(listingId,ctx));
  assert.equal(ctx.gateway.session.status,'expired');assert.equal(ctx.repo.listing.status,'available');
});
test('a session that cannot be expired must not release its reservation',async()=>{
  const ctx=fakeContext();ctx.repo.attachFails=true;ctx.gateway.expireFails=true;
  await assert.rejects(()=>createCheckout(listingId,ctx));
  assert.equal(ctx.repo.listing.status,'reserved');
});
test('cancellation requires a bound token and confirmed Stripe expiration',async()=>{
  const ctx=await pendingOrder();const token=signFlowToken('cancel',orderId,ctx.secret);
  await assert.rejects(()=>cancelCheckout(token+'x',ctx));
  const result=await cancelCheckout(token,ctx);assert.equal(result.status,'expired');assert.equal(ctx.repo.listing.status,'available');
  await cancelCheckout(token,ctx);assert.equal(ctx.repo.listing.status,'available');
});
test('cancel cannot make a completed payment available again',async()=>{
  const ctx=await pendingOrder();ctx.gateway.expireFails=true;ctx.gateway.session.status='complete';ctx.gateway.session.payment_status='paid';
  const result=await cancelCheckout(signFlowToken('cancel',orderId,ctx.secret),ctx);
  assert.equal(result.status,'pending');assert.equal(ctx.repo.listing.status,'reserved');
});
test('success receipt remains pending until the webhook settles it and excludes private fields',async()=>{
  const ctx=await pendingOrder();ctx.gateway.session.payment_status='paid';
  const result=await getOrderReceipt('cs_test_own',ctx);
  assert.equal(result.status,'pending');assert.equal(ctx.repo.listing.status,'reserved');
  assert.equal('buyer_email' in result,false);assert.equal('stripe_account_id' in result,false);
});
