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
    return account(await this.stripe.accounts.create({type:'express',country:'US',email,
      capabilities:{card_payments:{requested:true},transfers:{requested:true}},metadata:{marketplace_app_id:appId}},
      {idempotencyKey:'marketplace-seller-'+key}));
  }
  async getAccount(id:string) {
    const result=await this.stripe.accounts.retrieve(id);
    if('deleted' in result&&result.deleted)throw new PaymentError('Seller account is unavailable.',409);
    return account(result as Stripe.Account);
  }
  async createAccountLink(id:string,returnUrl:string,refreshUrl:string) {
    return (await this.stripe.accountLinks.create({account:id,type:'account_onboarding',return_url:returnUrl,refresh_url:refreshUrl})).url;
  }
  async createSession(spec:CheckoutSpec) {
    const {order}=spec;
    const metadata={marketplace_app_id:spec.appId,marketplace_order_id:order.id,marketplace_listing_id:order.listing_id,marketplace_order_proof:spec.proof};
    return session(await this.stripe.checkout.sessions.create({
      mode:'payment',allowed_payment_method_types:['card'],client_reference_id:order.id,metadata,
      line_items:[{quantity:1,price_data:{currency:order.currency,unit_amount:order.amount_cents,product_data:{name:order.listing_title}}}],
      payment_intent_data:{application_fee_amount:order.fee_cents,metadata},
      success_url:spec.successUrl,cancel_url:spec.cancelUrl,expires_at:spec.expiresAt,
    },{stripeAccount:order.stripe_account_id,idempotencyKey:'marketplace-checkout-'+order.id}));
  }
  async getSession(id:string,accountId:string) { return session(await this.stripe.checkout.sessions.retrieve(id,{},{stripeAccount:accountId})); }
  async expireSession(id:string,accountId:string) { return session(await this.stripe.checkout.sessions.expire(id,{},{stripeAccount:accountId})); }
  async getPaymentIntent(id:string,accountId:string) {
    const result=await this.stripe.paymentIntents.retrieve(id,{},{stripeAccount:accountId});
    return {id:result.id,status:result.status,amount:result.amount,amount_received:result.amount_received,currency:result.currency,
      application_fee_amount:result.application_fee_amount,livemode:result.livemode};
  }
}
