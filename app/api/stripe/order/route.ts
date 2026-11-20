import { getOrderReceipt } from '../../../../lib/payments/checkout';
import { getPaymentContext } from '../../../../lib/payments/server';
import { paymentResponse } from '../../../../lib/payments/http';
export async function GET(request:Request) {
  const sessionId=new URL(request.url).searchParams.get('session_id')??'';
  return paymentResponse(async()=>getOrderReceipt(sessionId,getPaymentContext()));
}
