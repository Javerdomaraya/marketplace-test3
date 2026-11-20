import { getPurchaseStatus } from '../../../../lib/payments/checkout';
import { getPaymentContext } from '../../../../lib/payments/server';
import { paymentResponse } from '../../../../lib/payments/http';
export async function GET(request:Request) {
  const listingId=new URL(request.url).searchParams.get('listingId')??'';
  return paymentResponse(async()=>getPurchaseStatus(listingId,getPaymentContext()));
}
