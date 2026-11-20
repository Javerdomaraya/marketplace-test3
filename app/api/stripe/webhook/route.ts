import { createWebhookHandler } from '../../../../lib/payments/webhook';
import { getStripe, getPaymentContext, webhookSecret } from '../../../../lib/payments/server';
import { paymentResponse } from '../../../../lib/payments/http';
export async function POST(request:Request) {
  return paymentResponse(async()=>{
    const stripe=getStripe();const secret=webhookSecret();
    return createWebhookHandler({verify:(raw,signature)=>stripe.webhooks.constructEvent(raw,signature,secret),getContext:getPaymentContext})(request);
  });
}
