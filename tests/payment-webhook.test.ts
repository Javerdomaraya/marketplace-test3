import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { processStripeEvent, createWebhookHandler } from '../lib/payments/webhook';
import { fakeContext, pendingOrder, orderId } from './helpers/payment-fakes';
import type { PaymentEvent } from '../lib/payments/types';
function event(object:unknown,type='checkout.session.completed',account='acct_testOwn'):PaymentEvent {
  return {id:'evt_test_own',type,account,livemode:false,data:{object}};
}
test('a paid matching direct charge settles exactly once',async()=>{
  const ctx=await pendingOrder();ctx.gateway.session.payment_status='paid';
  const e=event(ctx.gateway.session);await processStripeEvent(e,ctx);await processStripeEvent(e,ctx);
  assert.equal(ctx.repo.order!.status,'paid');assert.equal(ctx.repo.listing.status,'sold');assert.equal(ctx.repo.completed,1);
});
test('unpaid, live, foreign-account, and mismatched shared-sandbox events never settle',async()=>{
  for(const change of ['unpaid','live','account','amount','currency','fee','namespace','order','proof'] as const){
    const ctx=await pendingOrder();ctx.gateway.session.payment_status='paid';
    const e=event({...ctx.gateway.session,metadata:{...ctx.gateway.session.metadata}});
    const session=e.data.object as typeof ctx.gateway.session;
    if(change==='unpaid')session.payment_status='unpaid';
    if(change==='live')e.livemode=true;
    if(change==='account')e.account='acct_other';
    if(change==='amount')session.amount_total=1;
    if(change==='currency')session.currency='eur';
    if(change==='fee')ctx.gateway.intent.application_fee_amount=0;
    if(change==='namespace')session.metadata.marketplace_app_id='someone-else';
    if(change==='order')session.metadata.marketplace_order_id='20000000-0000-4000-8000-000000000099';
    if(change==='proof')session.metadata.marketplace_order_proof='forged';
    await processStripeEvent(e,ctx);assert.equal(ctx.repo.order!.status,'pending',change);assert.equal(ctx.repo.listing.status,'reserved',change);
  }
});
test('expired sessions release pending items but never unsell a paid item',async()=>{
  const ctx=await pendingOrder();
  await processStripeEvent(event({...ctx.gateway.session,status:'expired'},'checkout.session.expired'),ctx);
  assert.equal(ctx.repo.listing.status,'available');
  const paid=await pendingOrder();paid.gateway.session.payment_status='paid';await processStripeEvent(event(paid.gateway.session),paid);
  await processStripeEvent(event({...paid.gateway.session,status:'expired'},'checkout.session.expired'),paid);assert.equal(paid.repo.listing.status,'sold');
});
test('an owned expiration event recovers an order whose session persistence was interrupted',async()=>{
  const ctx=await pendingOrder();ctx.repo.order!.stripe_checkout_session_id=null;
  await processStripeEvent(event({...ctx.gateway.session,status:'expired'},'checkout.session.expired'),ctx);
  assert.equal(ctx.repo.listing.status,'available');
  assert.equal(ctx.gateway.specs.length,1,'replay the exact original idempotent operation');
});
test('copied order metadata cannot bind another provider session after an interrupted write',async()=>{
  const ctx=await pendingOrder();ctx.repo.order!.stripe_checkout_session_id=null;
  await processStripeEvent(event({...ctx.gateway.session,id:'cs_test_copied',status:'expired'},'checkout.session.expired'),ctx);
  assert.equal(ctx.repo.listing.status,'reserved');assert.notEqual(ctx.repo.order!.stripe_checkout_session_id,'cs_test_copied');
});
test('stored order proof survives a server credential rotation',async()=>{
  const ctx=await pendingOrder();ctx.secret='rotated-private-key';ctx.gateway.session.payment_status='paid';
  await processStripeEvent(event(ctx.gateway.session),ctx);
  assert.equal(ctx.repo.order!.status,'paid');
});
test('unbound sessions beyond the idempotency retention window require reconciliation',async()=>{
  const ctx=await pendingOrder();ctx.repo.order!.stripe_checkout_session_id=null;
  ctx.repo.order!.checkout_spec!.createdAt=Math.floor(Date.now()/1000)-86401;
  await assert.rejects(()=>processStripeEvent(event({...ctx.gateway.session,status:'expired'},'checkout.session.expired'),ctx),/reconcil/i);
  assert.equal(ctx.gateway.specs.length,0);assert.equal(ctx.repo.listing.status,'reserved');
});
test('account.updated refreshes a known account from Stripe and ignores foreign accounts',async()=>{
  const ctx=fakeContext();ctx.repo.seller!.charges_enabled=false;
  await processStripeEvent(event({...ctx.gateway.account,charges_enabled:false},'account.updated'),ctx);
  assert.equal(ctx.repo.seller!.charges_enabled,true);
  await processStripeEvent(event({id:'acct_other',metadata:{marketplace_app_id:'someone-else'}},'account.updated','acct_other'),ctx);
  assert.deepEqual(ctx.gateway.accountReads,['acct_testOwn']);
});
test('HTTP webhook verification uses the exact signed body and rejects tampering before writes',async()=>{
  const ctx=await pendingOrder();ctx.gateway.session.payment_status='paid';
  const stripe=new Stripe('sk_test_unit_only');const secret='whsec_unit_only';
  const handler=createWebhookHandler({verify:(raw,signature)=>stripe.webhooks.constructEvent(raw,signature,secret) as PaymentEvent,getContext:()=>ctx});
  const raw=JSON.stringify(event(ctx.gateway.session));const signature=stripe.webhooks.generateTestHeaderString({payload:raw,secret});
  const bad=await handler(new Request('http://localhost/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':signature},body:raw+' '}));
  assert.equal(bad.status,400);assert.equal(ctx.repo.listing.status,'reserved');
  const good=await handler(new Request('http://localhost/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':signature},body:raw}));
  assert.equal(good.status,200);assert.equal(ctx.repo.listing.status,'sold');
  const foreign=JSON.stringify(event({metadata:{marketplace_app_id:'other',marketplace_order_id:orderId}},'checkout.session.completed','acct_other'));
  const ignored=await handler(new Request('http://localhost/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':stripe.webhooks.generateTestHeaderString({payload:foreign,secret})},body:foreign}));
  assert.equal(ignored.status,200);
});
