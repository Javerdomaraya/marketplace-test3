import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { StripeGateway } from '../lib/payments/stripe-gateway';
import { pendingOrder } from './helpers/payment-fakes';
import { fakeContext, listingId, orderId } from './helpers/payment-fakes';
import { createCheckout } from '../lib/payments/checkout';
test('Stripe SDK sends a direct-charge Checkout request with the reserved price and platform fee',async()=>{
  const ctx=await pendingOrder();let captured:{headers:Headers;body:string}|null=null;
  const client=new Stripe('sk_test_unit_only',{maxNetworkRetries:0,httpClient:Stripe.createFetchHttpClient(async(_url,init)=>{
    captured={headers:new Headers(init?.headers),body:String(init?.body??'')};
    return new Response(JSON.stringify({id:'cs_test_protocol',url:'https://checkout.stripe.com/test',status:'open',payment_status:'unpaid',livemode:false}),{status:200,headers:{'content-type':'application/json'}});
  })});
  const gateway=new StripeGateway(client);
  await gateway.createSession({order:ctx.repo.order!,appId:ctx.appId,proof:'own-proof',createdAt:1999997900,expiresAt:2000000000,successUrl:'https://own.example/success',cancelUrl:'https://own.example/cancel'});
  const request=captured as unknown as {headers:Headers;body:string};assert.ok(request);
  assert.equal(request.headers.get('stripe-account'),'acct_testOwn');
  const params=new URLSearchParams(request.body);
  assert.equal(params.get('line_items[0][price_data][unit_amount]'),'7000');
  assert.equal(params.get('payment_intent_data[application_fee_amount]'),'700');
  assert.equal(params.get('metadata[marketplace_order_proof]'),'own-proof');
  assert.equal(params.get('allowed_payment_method_types[0]'),'card');
  assert.equal(params.get('expires_at'),'2000000000');
  assert.equal(params.get('adaptive_pricing[enabled]'),'false');
});
test('a lost Stripe response cannot be followed by a retry rejection that releases inventory',async()=>{
  const ctx=fakeContext();let attempts=0;
  const client=new Stripe('sk_test_unit_only',{maxNetworkRetries:2,httpClient:Stripe.createFetchHttpClient(async(url)=>{
    if(String(url).includes('/accounts/'))return new Response(JSON.stringify(ctx.gateway.account),{status:200,headers:{'content-type':'application/json'}});
    attempts++;
    if(attempts===1)throw Object.assign(new Error('Response lost after provider accepted creation'),{code:'ECONNRESET'});
    return new Response(JSON.stringify({error:{type:'rate_limit_error',message:'Rate limited'}}),{status:429,headers:{'content-type':'application/json','stripe-should-retry':'false'}});
  })});
  const gateway=new StripeGateway(client);
  await assert.rejects(()=>createCheckout(listingId,{...ctx,gateway},orderId));
  assert.equal(ctx.repo.listing.status,'reserved');
  assert.equal(attempts,2,'SDK closed-connection recovery must not turn a later rejection into an inventory release');
});
