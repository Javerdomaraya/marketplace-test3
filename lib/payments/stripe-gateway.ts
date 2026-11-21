import Stripe from 'stripe';
import { createHash } from 'node:crypto';
import { PaymentError, type PaymentGateway, type CheckoutSession, type CheckoutSpec, type ConnectedAccount } from './types';
function account(value:Stripe.Account):ConnectedAccount {
  return {id:value.id,details_submitted:Boolean(value.details_submitted),charges_enabled:Boolean(value.charges_enabled),
    payouts_enabled:Boolean(value.payouts_enabled),metadata:value.metadata??{}};
}
function session(value:Stripe.Checkout.Session):CheckoutSession {
  const status=value.status==='open'?'open':value.status==='complete'?'complete':value.status==='expired'?'expired':null;
  return {id:value.id,url:value.url,status,payment_status:value.payment_status,amount_total:value.amount_total,currency:value.currency,
    payment_intent:typeof value.payment_intent==='string'?value.payment_intent:value.payment_intent?.id??null,
    buyer_email:value.customer_details?.email??value.customer_email,metadata:value.metadata??{},livemode:value.livemode};
}
export class StripeGateway implements PaymentGateway {
  constructor(private readonly stripe:Stripe) {}
  async createAccount(email:string,appId:string) {
    const key=createHash('sha256').update(appId+':'+email).digest('hex');
    const created=await this.stripe.v2.core.accounts.create({
      contact_email:email,dashboard:'full',identity:{country:'US'},
      defaults:{currency:'usd',responsibilities:{fees_collector:'stripe',losses_collector:'stripe'}},
      configuration:{merchant:{capabilities:{card_payments:{requested:true}}}},
      metadata:{marketplace_app_id:appId},
    },{idempotencyKey:'marketplace-seller-v2-'+key});
    // Stripe's supported v1 view of a v2 account supplies the authoritative
    // readiness flags used by checkout and account.updated snapshot events.
    return this.getAccount(created.id);
  }
  async getAccount(id:string) {
    const result=await this.stripe.accounts.retrieve(id);
    if('deleted' in result&&result.deleted)throw new PaymentError('Seller account is unavailable.',409);
    return account(result as Stripe.Account);
  }
  async createAccountLink(id:string,returnUrl:string,refreshUrl:string) {
    return (await this.stripe.v2.core.accountLinks.create({account:id,use_case:{type:'account_onboarding',
      account_onboarding:{return_url:returnUrl,refresh_url:refreshUrl}}})).url;
  }
  async createSession(spec:CheckoutSpec) {
    const {order}=spec;
    const metadata={marketplace_app_id:spec.appId,marketplace_order_id:order.id,marketplace_listing_id:order.listing_id,marketplace_order_proof:spec.proof};
    const idempotencyKey='marketplace-checkout-'+order.id;
    let attempts=0;
    const onRequest=(event:{idempotency_key?:string})=>{if(event.idempotency_key===idempotencyKey)attempts++;};
    this.stripe.on('request',onRequest);
    try { return session(await this.stripe.checkout.sessions.create({
      mode:'payment',allowed_payment_method_types:['card'],adaptive_pricing:{enabled:false},client_reference_id:order.id,metadata,
      line_items:[{quantity:1,price_data:{currency:order.currency,unit_amount:order.amount_cents,product_data:{name:order.listing_title}}}],
      payment_intent_data:{application_fee_amount:order.fee_cents,metadata},
      success_url:spec.successUrl,cancel_url:spec.cancelUrl,expires_at:spec.expiresAt,
    // Stripe may retry a closed connection even with maxNetworkRetries=0.
    // Observe actual attempts before treating a final 4xx as definitive.
    },{stripeAccount:order.stripe_account_id,idempotencyKey,maxNetworkRetries:0})); }
    catch(error) {
      if(attempts<=1&&(error instanceof Stripe.errors.StripeInvalidRequestError||error instanceof Stripe.errors.StripeAuthenticationError||
        error instanceof Stripe.errors.StripePermissionError||error instanceof Stripe.errors.StripeRateLimitError)) {
        throw new PaymentError('Stripe could not start this checkout. Please check the item and seller payment setup.',502,'checkout_rejected');
      }
      throw error;
    } finally {this.stripe.off('request',onRequest);}
  }
  async getSession(id:string,accountId:string) { return session(await this.stripe.checkout.sessions.retrieve(id,{},{stripeAccount:accountId})); }
  async expireSession(id:string,accountId:string) { return session(await this.stripe.checkout.sessions.expire(id,{},{stripeAccount:accountId})); }
  async getPaymentIntent(id:string,accountId:string) {
    const result=await this.stripe.paymentIntents.retrieve(id,{},{stripeAccount:accountId});
    return {id:result.id,status:result.status,amount:result.amount,amount_received:result.amount_received,currency:result.currency,
      application_fee_amount:result.application_fee_amount,livemode:result.livemode};
  }
}
