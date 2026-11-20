import { randomUUID } from 'node:crypto';
import { isUuid } from '../validation';
import { normalizeSellerEmail, priceToCents, sellerReady } from './policy';
import { sellerFromAccount } from './onboarding';
import { createOrderProof, readFlowToken, signFlowToken } from './tokens';
import { PaymentError, type PaymentContext, type CheckoutSession } from './types';

export async function createCheckout(listingId:string, ctx:PaymentContext, purchaseId=randomUUID()) {
  if(!isUuid(listingId)) throw new PaymentError('Invalid listing.');
  const listing=await ctx.repo.findListing(listingId);
  if(!listing) throw new PaymentError('Listing not found.',404);
  if(listing.status!=='available') throw new PaymentError(listing.status==='sold'?'This item is sold.':'This item is reserved by another checkout.',409);
  priceToCents(listing.price);
  const seller=await ctx.repo.findSellerByEmail(normalizeSellerEmail(listing.seller_email));
  if(!seller || seller.app_id!==ctx.appId) throw new PaymentError('The seller has not enabled payments.',409);
  const account=await ctx.gateway.getAccount(seller.stripe_account_id);
  const fresh=sellerFromAccount(seller.email,ctx.appId,account);
  await ctx.repo.updateSeller(fresh);
  if(!sellerReady(fresh)) throw new PaymentError('The seller has not completed payment setup.',409);
  const order=await ctx.repo.reserveOrder(listingId,purchaseId);
  let session:CheckoutSession|null=null;
  try {
    session=await ctx.gateway.createSession({
      order,appId:ctx.appId,proof:createOrderProof(order,ctx.secret),expiresAt:Math.floor(Date.now()/1000)+1800,
      successUrl:ctx.siteUrl+'/checkout/success?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl:ctx.siteUrl+'/checkout/cancel?token='+encodeURIComponent(signFlowToken('cancel',order.id,ctx.secret)),
    });
    if(!session.url || session.livemode || !session.id.startsWith('cs_test_')) throw new PaymentError('Sandbox checkout could not be started.',502);
    await ctx.repo.attachSession(order.id,session.id);
    return {url:session.url};
  } catch(error) {
    try {
      if(!session) await ctx.repo.releaseOrder(order.id);
      else {
        const expired=await ctx.gateway.expireSession(session.id,order.stripe_account_id);
        if(expired.status==='expired') await ctx.repo.releaseOrder(order.id,session.id);
      }
    } catch { /* Keep reserved when Stripe expiration cannot be confirmed. */ }
    throw error;
  }
}
export async function cancelCheckout(token:string, ctx:PaymentContext) {
  const id=readFlowToken(token,'cancel',ctx.secret);
  const order=await ctx.repo.findOrder(id);
  if(!order) throw new PaymentError('Checkout not found.',404);
  if(order.status!=='pending') return {status:order.status,listingId:order.listing_id};
  if(!order.stripe_checkout_session_id) throw new PaymentError('Checkout is still being prepared. Try again shortly.',409);
  let session:CheckoutSession;
  try { session=await ctx.gateway.expireSession(order.stripe_checkout_session_id,order.stripe_account_id); }
  catch { session=await ctx.gateway.getSession(order.stripe_checkout_session_id,order.stripe_account_id); }
  if(session.status==='expired') {
    await ctx.repo.releaseOrder(order.id,session.id);
    const latest=await ctx.repo.findOrder(order.id);
    return {status:latest?.status??'expired',listingId:order.listing_id};
  }
  if(session.payment_status==='paid'||session.status==='complete') return {status:'pending',listingId:order.listing_id};
  throw new PaymentError('Checkout could not be cancelled yet. Please try again.',409);
}
export async function getOrderReceipt(sessionId:string, ctx:PaymentContext) {
  if(!/^cs_test_[A-Za-z0-9_]+$/.test(sessionId)||sessionId.length>255) throw new PaymentError('Invalid confirmation link.');
  const order=await ctx.repo.findOrderBySession(sessionId);
  if(!order) throw new PaymentError('Order confirmation is not available yet.',404,'order_pending');
  return {status:order.status,listingId:order.listing_id,title:order.listing_title,amountCents:order.amount_cents,currency:order.currency};
}
export async function getPurchaseStatus(listingId:string,ctx:PaymentContext) {
  if(!isUuid(listingId)) throw new PaymentError('Invalid listing.');
  const listing=await ctx.repo.findListing(listingId);
  if(!listing) throw new PaymentError('Listing not found.',404);
  const seller=await ctx.repo.findSellerByEmail(normalizeSellerEmail(listing.seller_email));
  let eligiblePrice=true;try{priceToCents(listing.price);}catch{eligiblePrice=false;}
  return {status:listing.status,canBuy:listing.status==='available'&&eligiblePrice&&seller?.app_id===ctx.appId&&sellerReady(seller),
    sellerReady:seller?.app_id===ctx.appId&&sellerReady(seller),eligiblePrice};
}
