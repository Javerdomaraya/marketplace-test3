import type { SupabaseClient } from '@supabase/supabase-js';
import { PaymentError, type Seller, type Order, type PaymentListing, type PaymentRepository } from './types';
type DbError={code?:string;message:string};
function check(error:DbError|null) {
  if(!error)return;
  if(['42P01','42703','PGRST202','PGRST205'].includes(error.code??''))throw new PaymentError('Payments are temporarily unavailable.',503,'not_configured');
  if(error.code==='P0001') {
    if(/not found/i.test(error.message))throw new PaymentError('Listing or order not found.',404);
    if(/seller/i.test(error.message))throw new PaymentError('The seller has not enabled payments.',409);
    if(/sold/i.test(error.message))throw new PaymentError('This item is sold.',409);
    if(/reserved/i.test(error.message))throw new PaymentError('This item is reserved by another checkout.',409);
    if(/price/i.test(error.message))throw new PaymentError('This item does not meet the Checkout price requirements.',400);
    throw new PaymentError('The payment state changed. Please refresh and try again.',409);
  }
  throw new PaymentError('Payments are temporarily unavailable. Please try again.',503);
}
function order(value:unknown):Order {
  const row=value as Order;
  return {...row,amount_cents:Number(row.amount_cents),fee_cents:Number(row.fee_cents)};
}
export class SupabasePaymentRepository implements PaymentRepository {
  constructor(private readonly db:SupabaseClient) {}
  async findListing(id:string) {
    const {data,error}=await this.db.from('listings').select('id,title,price,seller_email,status,sold_at').eq('id',id).maybeSingle();
    check(error);return data as PaymentListing|null;
  }
  async findSellerByEmail(email:string) {
    const {data,error}=await this.db.from('marketplace_sellers').select('*').eq('email',email).maybeSingle();
    check(error);return data as Seller|null;
  }
  async findSellerByAccount(id:string) {
    const {data,error}=await this.db.from('marketplace_sellers').select('*').eq('stripe_account_id',id).maybeSingle();
    check(error);return data as Seller|null;
  }
  async saveSeller(seller:Seller) {
    const {error}=await this.db.from('marketplace_sellers').upsert(seller,{onConflict:'email',ignoreDuplicates:true});check(error);
    const stored=await this.findSellerByEmail(seller.email);
    if(!stored)throw new PaymentError('Seller connection could not be saved.',503);
    return stored;
  }
  async updateSeller(seller:Seller) {
    const {error}=await this.db.from('marketplace_sellers').update({details_submitted:seller.details_submitted,charges_enabled:seller.charges_enabled,
      payouts_enabled:seller.payouts_enabled,updated_at:new Date().toISOString()}).eq('stripe_account_id',seller.stripe_account_id).eq('app_id',seller.app_id);
    check(error);
  }
  async reserveOrder(listingId:string,orderId:string) {
    const {data,error}=await this.db.rpc('reserve_marketplace_order',{p_listing_id:listingId,p_order_id:orderId});check(error);
    return order(data);
  }
  async attachSession(orderId:string,sessionId:string) {
    const {error}=await this.db.rpc('attach_marketplace_checkout',{p_order_id:orderId,p_session_id:sessionId});check(error);
  }
  async findOrder(id:string) {
    const {data,error}=await this.db.from('marketplace_orders').select('*').eq('id',id).maybeSingle();check(error);return data?order(data):null;
  }
  async findOrderBySession(id:string) {
    const {data,error}=await this.db.from('marketplace_orders').select('*').eq('stripe_checkout_session_id',id).maybeSingle();check(error);return data?order(data):null;
  }
  async releaseOrder(id:string,session?:string) {
    const {data,error}=await this.db.rpc('release_marketplace_order',{p_order_id:id,p_session_id:session??null});check(error);return data===true;
  }
  async completeOrder(id:string,values:Parameters<PaymentRepository['completeOrder']>[1]) {
    const {data,error}=await this.db.rpc('complete_marketplace_order',{p_order_id:id,p_session_id:values.sessionId,p_payment_intent_id:values.paymentIntentId,
      p_account_id:values.accountId,p_amount_cents:values.amountCents,p_fee_cents:values.feeCents,p_currency:values.currency,p_buyer_email:values.buyerEmail});
    check(error);return data===true;
  }
}
