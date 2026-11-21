'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { PaymentShell } from '../../../components/payments/payment-shell';
import { Button } from '../../../components/ui/button';
import { paymentJson } from '../../../lib/payment-client';
import { formatPrice } from '../../../lib/utils';
type Receipt={status:'pending'|'paid'|'expired';listingId:string;title:string;amountCents:number;currency:string};
export default function SuccessPage(){return <Suspense fallback={<PaymentShell title="Confirming payment"><p className="mt-4 text-sm text-slate-500">Loading confirmation...</p></PaymentShell>}><SuccessContent/></Suspense>;}
function SuccessContent() {
  const params=useSearchParams();const sessionId=params.get('session_id')??'';
  return <ReceiptContent key={sessionId} sessionId={sessionId}/>;
}
function ReceiptContent({sessionId}:{sessionId:string}) {
  const [receipt,setReceipt]=useState<Receipt|null>(null);const [error,setError]=useState('');const [slow,setSlow]=useState(false);const [retry,setRetry]=useState(0);
  const valid=/^cs_test_[A-Za-z0-9_]+$/.test(sessionId);
  useEffect(()=>{
    if(!valid)return;
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    async function check(attempt:number) {
      try {
        const response=await fetch('/api/stripe/order?session_id='+encodeURIComponent(sessionId),{cache:'no-store',signal:controller.signal});
        if(response.status===404&&attempt<15){timer=setTimeout(()=>void check(attempt+1),2000);return;}
        const data=await paymentJson<Receipt>(response);if(controller.signal.aborted)return;
        setReceipt(data);setError('');
        if(data.status==='pending'){if(attempt<15)timer=setTimeout(()=>void check(attempt+1),2000);else setSlow(true);}
      } catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Confirmation is temporarily unavailable.');}
    }
    void check(0);return()=>{controller.abort();if(timer)clearTimeout(timer);};
  },[sessionId,valid,retry]);
  const paid=receipt?.status==='paid';
  return <PaymentShell title={paid?'Test payment confirmed':receipt?.status==='expired'?'Checkout expired':'Confirming payment'}>
    {!valid?<p role="alert" className="mt-5 text-sm text-red-700">This confirmation link is missing or invalid.</p>:
      paid?<div role="status" className="mt-5"><CheckCircle2 size={42} className="text-green-600"/><p className="mt-4 font-semibold">Your order is saved and the listing is marked Sold.</p><div className="mt-5 rounded-xl bg-slate-50 p-5"><p className="font-bold">{receipt.title}</p><p className="mt-2 text-xl font-extrabold">{formatPrice(receipt.amountCents/100)}</p></div></div>:
      receipt?.status==='expired'?<p className="mt-5 text-sm text-slate-600">This checkout was cancelled or expired. No paid order was recorded for it.</p>:
      <p role="status" className="mt-5 flex items-start gap-3 text-sm leading-6 text-slate-600"><LoaderCircle size={20} className="mt-0.5 shrink-0 animate-spin"/>{slow?'Confirmation is taking longer than expected. Please check again before attempting another payment.':'Waiting for Stripe payment confirmation. This page will update automatically.'}</p>}
    {error&&<p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {(slow||error)&&valid&&<Button variant="outline" className="mt-5" onClick={()=>{setSlow(false);setError('');setRetry(value=>value+1);}}>Check payment status</Button>}
    <Button asChild className="mt-6"><Link href={receipt?'/item/'+receipt.listingId:'/'}>{receipt?'View listing':'Browse Marketplace'}</Link></Button>
    <p className="mt-5 text-xs leading-5 text-slate-500">Only the server&apos;s verified payment record confirms your order. No real money moves in this sandbox.</p>
  </PaymentShell>;
}
