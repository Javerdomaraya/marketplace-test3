import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { StripeGateway } from '../lib/payments/stripe-gateway';
import { pendingOrder } from './helpers/payment-fakes';
test('Stripe SDK sends a direct-charge Checkout request with the reserved price and platform fee',async()=>{
  const ctx=await pendingOrder();let captured:{headers:Headers;body:string}|null=null;
  const client=new Stripe('sk_test_unit_only',{maxNetworkRetries:0,httpClient:Stripe.createFetchHttpClient(async(_url,init)=>{
    captured={headers:new Headers(init?.headers),body:String(init?.body??'')};
    return new Response(JSON.stringify({id:'cs_test_protocol',url:'https://checkout.stripe.com/test',status:'open',payment_status:'unpaid',livemode:false}),{status:200,headers:{'content-type':'application/json'}});
  })});
  const gateway=new StripeGateway(client);
  await gateway.createSession({order:ctx.repo.order!,appId:ctx.appId,proof:'own-proof',expiresAt:2000000000,successUrl:'https://own.example/success',cancelUrl:'https://own.example/cancel'});
  const request=captured as unknown as {headers:Headers;body:string};assert.ok(request);
  assert.equal(request.headers.get('stripe-account'),'acct_testOwn');
  const params=new URLSearchParams(request.body);
  assert.equal(params.get('line_items[0][price_data][unit_amount]'),'7000');
  assert.equal(params.get('payment_intent_data[application_fee_amount]'),'700');
  assert.equal(params.get('metadata[marketplace_order_proof]'),'own-proof');
  assert.equal(params.get('allowed_payment_method_types[0]'),'card');
  assert.equal(params.get('expires_at'),'2000000000');
});
