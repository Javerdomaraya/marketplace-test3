import { normalizeSellerEmail, sellerReady } from './policy';
import { readFlowToken, signFlowToken } from './tokens';
import { PaymentError, type PaymentContext, type ConnectedAccount, type Seller } from './types';

export function sellerFromAccount(email:string, appId:string, account:ConnectedAccount):Seller {
  if(account.metadata.marketplace_app_id !== appId) throw new PaymentError('This seller account is not linked to this marketplace.',409);
  return {email,stripe_account_id:account.id,app_id:appId,details_submitted:account.details_submitted,
    charges_enabled:account.charges_enabled,payouts_enabled:account.payouts_enabled};
}
async function onboardingLink(accountId:string, ctx:PaymentContext) {
  const token=signFlowToken('onboarding',accountId,ctx.secret);
  const query='?token='+encodeURIComponent(token);
  return {url:await ctx.gateway.createAccountLink(accountId,ctx.siteUrl+'/api/stripe/onboarding/return'+query,ctx.siteUrl+'/api/stripe/onboarding/refresh'+query)};
}
export async function beginOnboarding(value:string, ctx:PaymentContext) {
  const email=normalizeSellerEmail(value);
  let seller=await ctx.repo.findSellerByEmail(email);
  if(!seller) {
    const account=await ctx.gateway.createAccount(email,ctx.appId);
    seller=await ctx.repo.saveSeller(sellerFromAccount(email,ctx.appId,account));
  }
  if(seller.app_id!==ctx.appId) throw new PaymentError('This seller account is not linked to this marketplace.',409);
  return onboardingLink(seller.stripe_account_id,ctx);
}
async function knownSeller(token:string, ctx:PaymentContext) {
  const id=readFlowToken(token,'onboarding',ctx.secret);
  const seller=await ctx.repo.findSellerByAccount(id);
  if(!seller || seller.app_id!==ctx.appId) throw new PaymentError('Seller connection not found. Start again.',404);
  return seller;
}
export async function refreshOnboarding(token:string, ctx:PaymentContext) {
  const seller=await knownSeller(token,ctx);
  return onboardingLink(seller.stripe_account_id,ctx);
}
export async function finishOnboarding(token:string, ctx:PaymentContext) {
  const seller=await knownSeller(token,ctx);
  const account=await ctx.gateway.getAccount(seller.stripe_account_id);
  const fresh=sellerFromAccount(seller.email,ctx.appId,account);
  await ctx.repo.updateSeller(fresh);
  return {ready:sellerReady(fresh)};
}
