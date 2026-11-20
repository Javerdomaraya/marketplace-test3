import { isUuid } from '../validation';
import { verifyOrderProof } from './tokens';
import { sellerFromAccount } from './onboarding';
import type { PaymentContext, PaymentEvent } from './types';
function record(value:unknown):Record<string,unknown>|null {
  return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
}
export async function processStripeEvent(event:PaymentEvent,ctx:PaymentContext):Promise<string> {
  if(event.livemode) return 'ignored';
  const object=record(event.data?.object);if(!object)return 'ignored';
  const metadata=record(object.metadata);
  if(metadata?.marketplace_app_id!==ctx.appId)return 'ignored';
  if(event.type==='account.updated') {
    if(typeof object.id!=='string')return 'ignored';
    const seller=await ctx.repo.findSellerByAccount(object.id);
    if(!seller||seller.app_id!==ctx.appId)return 'ignored';
    const fresh=await ctx.gateway.getAccount(seller.stripe_account_id);
    await ctx.repo.updateSeller(sellerFromAccount(seller.email,ctx.appId,fresh));
    return 'account_updated';
  }
  if(event.type!=='checkout.session.completed'&&event.type!=='checkout.session.expired')return 'ignored';
  const orderId=metadata.marketplace_order_id;
  if(typeof orderId!=='string'||!isUuid(orderId)||typeof object.id!=='string'||!object.id.startsWith('cs_test_')||object.livemode===true)return 'ignored';
  const order=await ctx.repo.findOrder(orderId);
  if(!order||event.account!==order.stripe_account_id||object.amount_total!==order.amount_cents||object.currency!==order.currency||
    (order.stripe_checkout_session_id!==null&&order.stripe_checkout_session_id!==object.id)||
    !verifyOrderProof(String(metadata.marketplace_order_proof??''),order,ctx.secret))return 'ignored';
  if(event.type==='checkout.session.expired') {
    if(object.status==='expired'&&order.status==='pending'&&order.stripe_checkout_session_id===object.id) await ctx.repo.releaseOrder(order.id,object.id);
    return 'expired';
  }
  if(object.payment_status!=='paid')return 'ignored';
  const payment=typeof object.payment_intent==='string'?object.payment_intent:record(object.payment_intent)?.id;
  if(typeof payment!=='string'||!payment.startsWith('pi_'))return 'ignored';
  if(order.status==='paid')return order.stripe_payment_intent_id===payment?'paid':'ignored';
  if(order.status!=='pending')return 'ignored';
  const intent=await ctx.gateway.getPaymentIntent(payment,order.stripe_account_id);
  if(intent.id!==payment||intent.livemode||intent.status!=='succeeded'||intent.amount!==order.amount_cents||
    intent.amount_received!==order.amount_cents||intent.currency!==order.currency||intent.application_fee_amount!==order.fee_cents)return 'ignored';
  const details=record(object.customer_details);
  const buyerEmail=typeof details?.email==='string'?details.email:typeof object.customer_email==='string'?object.customer_email:null;
  await ctx.repo.completeOrder(order.id,{sessionId:object.id,paymentIntentId:intent.id,accountId:order.stripe_account_id,
    amountCents:intent.amount,feeCents:order.fee_cents,currency:intent.currency,buyerEmail});
  return 'paid';
}
export function createWebhookHandler(deps:{verify:(raw:string,signature:string)=>PaymentEvent;getContext:()=>PaymentContext|Promise<PaymentContext>}) {
  return async(request:Request):Promise<Response>=>{
    let event:PaymentEvent;
    try {
      const signature=request.headers.get('stripe-signature');if(!signature)throw new Error('Missing signature');
      const raw=await request.text();if(raw.length>1024*1024)throw new Error('Large webhook');
      event=deps.verify(raw,signature);
    } catch { return Response.json({error:'Invalid webhook signature or payload.'},{status:400}); }
    if(event.livemode||!['checkout.session.completed','checkout.session.expired','account.updated'].includes(event.type))return Response.json({received:true});
    try { await processStripeEvent(event,await deps.getContext());return Response.json({received:true}); }
    catch { console.error('Marketplace webhook processing failed; Stripe may retry.');return Response.json({error:'Payment processing is temporarily unavailable.'},{status:500}); }
  };
}
