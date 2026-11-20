import { createCheckout } from '../../../../lib/payments/checkout';
import { getPaymentContext } from '../../../../lib/payments/server';
import { paymentResponse, requestBody, requiredString } from '../../../../lib/payments/http';
export async function POST(request:Request) {
  return paymentResponse(async()=>{const ctx=getPaymentContext();const body=await requestBody(request,ctx.siteUrl);return createCheckout(requiredString(body,'listingId'),ctx);});
}
