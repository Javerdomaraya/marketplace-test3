import { refreshOnboarding } from '../../../../../lib/payments/onboarding';
import { getPaymentContext } from '../../../../../lib/payments/server';
import { paymentResponse, redirectTo } from '../../../../../lib/payments/http';
export async function GET(request:Request) {
  const token=new URL(request.url).searchParams.get('token')??'';
  return paymentResponse(async()=>{const result=await refreshOnboarding(token,getPaymentContext());return redirectTo(result.url);});
}
