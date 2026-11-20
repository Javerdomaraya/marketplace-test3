import { beginOnboarding } from '../../../../lib/payments/onboarding';
import { getPaymentContext } from '../../../../lib/payments/server';
import { paymentResponse, requestBody, requiredString } from '../../../../lib/payments/http';
export async function POST(request:Request) {
  return paymentResponse(async()=>{const ctx=getPaymentContext();const body=await requestBody(request,ctx.siteUrl);return beginOnboarding(requiredString(body,'email'),ctx);});
}
