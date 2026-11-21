import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { StripeGateway } from '../lib/payments/stripe-gateway';
import { pendingOrder } from './helpers/payment-fakes';
import { fakeContext, listingId, orderId } from './helpers/payment-fakes';
import { createCheckout } from '../lib/payments/checkout';
import { beginOnboarding } from '../lib/payments/onboarding';
test('new hosted Checkout offers local currency and buyer name while preserving the direct charge and platform fee',async()=>{
  const ctx=await pendingOrder();let captured:{headers:Headers;body:string}|null=null;
  const client=new Stripe('sk_test_unit_only',{maxNetworkRetries:0,httpClient:Stripe.createFetchHttpClient(async(_url,init)=>{
    captured={headers:new Headers(init?.headers),body:String(init?.body??'')};
    return new Response(JSON.stringify({id:'cs_test_protocol',url:'https://checkout.stripe.com/test',status:'open',payment_status:'unpaid',livemode:false}),{status:200,headers:{'content-type':'application/json'}});
  })});
  const gateway=new StripeGateway(client);
  await gateway.createSession({checkoutVersion:2,order:ctx.repo.order!,appId:ctx.appId,proof:'own-proof',createdAt:1999997900,expiresAt:2000000000,successUrl:'https://own.example/success',cancelUrl:'https://own.example/cancel'});
  const request=captured as unknown as {headers:Headers;body:string};assert.ok(request);
  assert.equal(request.headers.get('stripe-account'),'acct_testOwn');
  const params=new URLSearchParams(request.body);
  assert.equal(params.get('line_items[0][price_data][unit_amount]'),'7000');
  assert.equal(params.get('payment_intent_data[application_fee_amount]'),'700');
  assert.equal(params.get('metadata[marketplace_order_proof]'),'own-proof');
  assert.equal(params.get('allowed_payment_method_types[0]'),'card');
  assert.equal(params.get('expires_at'),'2000000000');
  assert.equal(params.get('adaptive_pricing[enabled]'),'true');
  assert.equal(params.get('name_collection[individual][enabled]'),'true');
  assert.equal(params.get('name_collection[individual][optional]'),'false');
  assert.equal(params.get('wallet_options[link][display]'),'auto');
  assert.equal(params.get('billing_address_collection'),null,'let Stripe collect country/billing fields without forcing a street address');
  assert.equal(params.get('customer_creation'),null,'do not force a Marketplace customer wallet');
  assert.equal(params.get('saved_payment_method_options[payment_method_save]'),null);
  assert.equal(params.get('payment_intent_data[setup_future_usage]'),null,'optional Link saving does not force future-charge consent');
});

test('unversioned orders replay the exact legacy USD Checkout options',async()=>{
  const ctx=await pendingOrder();let body='';
  const client=new Stripe('sk_test_unit_only',{maxNetworkRetries:0,httpClient:Stripe.createFetchHttpClient(async(_url,init)=>{
    body=String(init?.body??'');return new Response(JSON.stringify({id:'cs_test_legacy',url:'https://checkout.stripe.com/test',status:'open',payment_status:'unpaid',livemode:false}),{status:200});
  })});
  await new StripeGateway(client).createSession({...ctx.repo.order!.checkout_spec!,order:ctx.repo.order!});
  const params=new URLSearchParams(body);
  assert.equal(params.get('adaptive_pricing[enabled]'),'false');
  assert.equal(params.get('allowed_payment_method_types[0]'),'card');
  assert.equal(params.get('name_collection[individual][enabled]'),null);
  assert.equal(params.get('wallet_options[link][display]'),null);
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

test('seller setup uses sandbox-supported Accounts v2 and hosted onboarding while preserving readiness checks',async()=>{
  const ctx=fakeContext();ctx.repo.seller=null;
  const requests:{path:string;method:string;headers:Headers;body:string}[]=[];
  const stripe=new Stripe('sk_test_unit_only',{maxNetworkRetries:0,httpClient:Stripe.createFetchHttpClient(async(url,init)=>{
    const path=new URL(String(url)).pathname;
    requests.push({path,method:String(init?.method),headers:new Headers(init?.headers),body:String(init?.body??'')});
    const response=path==='/v2/core/accounts'?{id:'acct_testOwn',object:'v2.core.account',livemode:false,metadata:{marketplace_app_id:'own-app'}}:
      path==='/v1/accounts/acct_testOwn'?{...ctx.gateway.account,details_submitted:false,charges_enabled:false,payouts_enabled:false}:
      path==='/v2/core/account_links'?{url:'https://connect.stripe.com/setup/own',object:'v2.core.account_link'}:null;
    return new Response(JSON.stringify(response??{error:{type:'invalid_request_error',message:'Use Accounts v2 with Stripe as losses collector.'}}),{status:response?200:400,headers:{'content-type':'application/json'}});
  })});
  const gateway=new StripeGateway(stripe);
  const result=await beginOnboarding(' Seller@Example.COM ',{...ctx,gateway});
  assert.equal(result.url,'https://connect.stripe.com/setup/own');
  assert.equal(ctx.repo.seller!.stripe_account_id,'acct_testOwn');
  assert.equal(ctx.repo.seller!.charges_enabled,false);
  const create=requests.find(r=>r.path==='/v2/core/accounts')!;
  const payload=JSON.parse(create.body);
  assert.equal(payload.contact_email,'seller@example.com');
  assert.equal(payload.dashboard,'full');
  assert.deepEqual(payload.defaults.responsibilities,{fees_collector:'stripe',losses_collector:'stripe'});
  assert.equal(payload.configuration.merchant.capabilities.card_payments.requested,true);
  assert.equal(payload.metadata.marketplace_app_id,'own-app');
  assert.equal('type' in payload,false);
  assert.match(create.headers.get('idempotency-key')??'',/^marketplace-seller-v2-/);
  const onboarding=JSON.parse(requests.find(r=>r.path==='/v2/core/account_links')!.body);
  assert.equal(onboarding.account,'acct_testOwn');
  assert.equal(onboarding.use_case.type,'account_onboarding');
  assert.match(onboarding.use_case.account_onboarding.return_url,/\/api\/stripe\/onboarding\/return\?token=/);
  assert.match(onboarding.use_case.account_onboarding.refresh_url,/\/api\/stripe\/onboarding\/refresh\?token=/);
  await beginOnboarding('seller@example.com',{...ctx,gateway});
  assert.equal(requests.filter(r=>r.path==='/v2/core/accounts').length,1,'restarting must reuse the saved account');
});
