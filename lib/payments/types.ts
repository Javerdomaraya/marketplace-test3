export class PaymentError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = 'payment_error') {
    super(message);
    this.name = 'PaymentError';
  }
}
export type ListingStatus = 'available' | 'reserved' | 'sold';
export type Seller = {
  email: string; stripe_account_id: string; app_id: string;
  details_submitted: boolean; charges_enabled: boolean; payouts_enabled: boolean;
};
export type PaymentListing = {
  id: string; title: string; price: number | string; seller_email: string;
  status: ListingStatus; sold_at?: string | null;
};
export type Order = {
  id: string; listing_id: string; listing_title: string; seller_email: string;
  stripe_account_id: string; amount_cents: number; fee_cents: number; currency: 'usd';
  status: 'pending' | 'paid' | 'expired'; stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null; buyer_email?: string | null; paid_at?: string | null;
  checkout_spec?: Omit<CheckoutSpec,'order'> | null;
};
export type ConnectedAccount = {
  id: string; details_submitted: boolean; charges_enabled: boolean; payouts_enabled: boolean;
  metadata: Record<string, string>;
};
export type CheckoutSession = {
  id: string; url: string | null; status: 'open' | 'complete' | 'expired' | null;
  payment_status: string; amount_total: number | null; currency: string | null;
  payment_intent: string | null; buyer_email: string | null;
  metadata: Record<string, string>; livemode: boolean;
};
export type PaymentIntent = {
  id: string; status: string; amount: number; amount_received: number; currency: string;
  application_fee_amount: number | null; livemode: boolean;
};
export type CheckoutSpec = {
  order: Order; successUrl: string; cancelUrl: string; appId: string; proof: string; expiresAt: number; createdAt: number;
};
export interface PaymentGateway {
  createAccount(email: string, appId: string): Promise<ConnectedAccount>;
  getAccount(id: string): Promise<ConnectedAccount>;
  createAccountLink(id: string, returnUrl: string, refreshUrl: string): Promise<string>;
  createSession(spec: CheckoutSpec): Promise<CheckoutSession>;
  getSession(id: string, account: string): Promise<CheckoutSession>;
  expireSession(id: string, account: string): Promise<CheckoutSession>;
  getPaymentIntent(id: string, account: string): Promise<PaymentIntent>;
}
export interface PaymentRepository {
  findListing(id: string): Promise<PaymentListing | null>;
  findSellerByEmail(email: string): Promise<Seller | null>;
  findSellerByAccount(account: string): Promise<Seller | null>;
  saveSeller(seller: Seller): Promise<Seller>;
  updateSeller(seller: Seller): Promise<void>;
  reserveOrder(listingId: string, orderId: string): Promise<Order>;
  saveCheckoutSpec(orderId: string, spec: Omit<CheckoutSpec,'order'>): Promise<void>;
  attachSession(orderId: string, sessionId: string): Promise<void>;
  findOrder(id: string): Promise<Order | null>;
  findOrderBySession(sessionId: string): Promise<Order | null>;
  releaseOrder(orderId: string, sessionId?: string): Promise<boolean>;
  completeOrder(orderId: string, values: {
    sessionId: string; paymentIntentId: string; accountId: string;
    amountCents: number; feeCents: number; currency: string; buyerEmail: string | null;
  }): Promise<boolean>;
}
export type PaymentContext = {
  repo: PaymentRepository; gateway: PaymentGateway; secret: string; siteUrl: string; appId: string;
};
export type PaymentEvent = { id: string; type: string; livemode: boolean; account?: string; data: { object: unknown } };
