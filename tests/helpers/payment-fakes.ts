import { PaymentError, type Seller, type Order, type PaymentListing, type PaymentRepository, type PaymentGateway, type PaymentContext, type ConnectedAccount, type CheckoutSession, type CheckoutSpec, type PaymentIntent } from '../../lib/payments/types';
import { createOrderProof } from '../../lib/payments/tokens';
export const listingId = '10000000-0000-4000-8000-000000000001';
export const orderId = '20000000-0000-4000-8000-000000000001';
export class FakeRepository implements PaymentRepository {
  listing: PaymentListing = { id:listingId,title:'Bicycle',price:'70.00',seller_email:'Seller@Example.com',status:'available' };
  seller: Seller | null = { email:'seller@example.com',stripe_account_id:'acct_testOwn',app_id:'own-app',details_submitted:true,charges_enabled:true,payouts_enabled:true };
  order: Order | null = null;
  attachFails = false;
  completed = 0;
  async findListing(id:string) { return id === this.listing.id ? this.listing : null; }
  async findSellerByEmail(email:string) { return this.seller?.email === email ? this.seller : null; }
  async findSellerByAccount(id:string) { return this.seller?.stripe_account_id === id ? this.seller : null; }
  async saveSeller(seller:Seller) { this.seller ??= seller; return this.seller; }
  async updateSeller(seller:Seller) { this.seller = { ...seller }; }
  async reserveOrder(id:string, purchaseId:string) {
    if (id !== this.listing.id || this.listing.status !== 'available') throw new PaymentError('Item is reserved or sold.',409);
    this.listing.status = 'reserved';
    this.order = { id:purchaseId,listing_id:id,listing_title:this.listing.title,seller_email:this.seller!.email,stripe_account_id:this.seller!.stripe_account_id,
      amount_cents:7000,fee_cents:700,currency:'usd',status:'pending',stripe_checkout_session_id:null,stripe_payment_intent_id:null };
    return { ...this.order };
  }
  async attachSession(id:string, session:string) { if(this.attachFails) throw new Error('DB unavailable'); this.order!.stripe_checkout_session_id=session; }
  async saveCheckoutSpec(id:string,spec:Omit<CheckoutSpec,'order'>) { if(this.order?.id!==id)throw new Error('Unknown order');this.order.checkout_spec={...spec}; }
  async findOrder(id:string) { return this.order?.id === id ? this.order : null; }
  async findOrderBySession(id:string) { return this.order?.stripe_checkout_session_id === id ? this.order : null; }
  async releaseOrder(id:string, session?:string) {
    if(!this.order || this.order.id!==id || this.order.status!=='pending') return false;
    if(this.order.stripe_checkout_session_id && this.order.stripe_checkout_session_id !== session) throw new Error('Wrong session');
    this.order.status='expired'; this.listing.status='available'; return true;
  }
  async completeOrder(id:string, values:Parameters<PaymentRepository['completeOrder']>[1]) {
    if(!this.order || this.order.id!==id) throw new Error('Unknown order');
    if(this.order.status==='paid') return true;
    this.completed++; this.order.status='paid'; this.order.stripe_checkout_session_id=values.sessionId;
    this.order.stripe_payment_intent_id=values.paymentIntentId; this.listing.status='sold'; return true;
  }
}
export class FakeGateway implements PaymentGateway {
  account:ConnectedAccount={id:'acct_testOwn',details_submitted:true,charges_enabled:true,payouts_enabled:true,metadata:{marketplace_app_id:'own-app'}};
  session:CheckoutSession={id:'cs_test_own',url:'https://checkout.stripe.com/test',status:'open',payment_status:'unpaid',amount_total:7000,currency:'usd',
    payment_intent:'pi_own',buyer_email:'buyer@example.com',metadata:{marketplace_app_id:'own-app',marketplace_order_id:orderId,marketplace_listing_id:listingId},livemode:false};
  intent:PaymentIntent={id:'pi_own',status:'succeeded',amount:7000,amount_received:7000,currency:'usd',application_fee_amount:700,livemode:false};
  specs:CheckoutSpec[]=[]; accountReads:string[]=[]; createdEmails:string[]=[];
  createFails=false; createRejects=false; expireFails=false;
  async createAccount(email:string) { this.createdEmails.push(email); return this.account; }
  async getAccount(id:string) { this.accountReads.push(id); if(id!==this.account.id) throw new Error('Unknown account'); return this.account; }
  async createAccountLink(id:string, returnUrl:string, refreshUrl:string) { return 'https://connect.stripe.com/setup/test?return=' + encodeURIComponent(returnUrl) + '&refresh=' + encodeURIComponent(refreshUrl); }
  async createSession(spec:CheckoutSpec) { this.specs.push(spec); if(this.createRejects) throw new PaymentError('Checkout rejected',502,'checkout_rejected'); if(this.createFails) throw new Error('Provider outcome unknown'); this.session.metadata.marketplace_order_id=spec.order.id; this.session.metadata.marketplace_order_proof=spec.proof; return {...this.session}; }
  async getSession() { return {...this.session}; }
  async expireSession() { if(this.expireFails) throw new Error('Already completed'); this.session.status='expired'; return {...this.session}; }
  async getPaymentIntent() { return {...this.intent}; }
}
export function fakeContext(): PaymentContext & {repo:FakeRepository;gateway:FakeGateway} {
  return {repo:new FakeRepository(),gateway:new FakeGateway(),secret:'sk_test_unit_signing_only',siteUrl:'http://localhost:3000',appId:'own-app'};
}
export async function pendingOrder() {
  const ctx=fakeContext(); const order=await ctx.repo.reserveOrder(listingId,orderId);
  const proof=createOrderProof(order,ctx.secret);
  await ctx.repo.saveCheckoutSpec(orderId,{proof,appId:ctx.appId,createdAt:Math.floor(Date.now()/1000),expiresAt:Math.floor(Date.now()/1000)+2100,successUrl:'http://localhost:3000/success',cancelUrl:'http://localhost:3000/cancel'});
  await ctx.repo.attachSession(orderId,'cs_test_own'); ctx.gateway.session.metadata.marketplace_order_proof=proof; return ctx;
}
