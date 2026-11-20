'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';
import { PaymentShell } from '../../../components/payments/payment-shell';
import { Button } from '../../../components/ui/button';
import { paymentJson } from '../../../lib/payment-client';
type CancelResult={status:'pending'|'paid'|'expired';listingId:string};
export default function CancelPage(){return <Suspense fallback={<PaymentShell title="Checking checkout"><p className="mt-4 text-sm text-slate-500">Loading checkout...</p></PaymentShell>}><CancelContent/></Suspense>;}
function CancelContent() {
  const params=useSearchParams();const token=params.get('token')??'';
  const [result,setResult]=useState<CancelResult|null>(null);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!token)return;const controller=new AbortController();
    async function cancel() {
      try{const data=await paymentJson<CancelResult>(await fetch('/api/stripe/checkout/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),signal:controller.signal}));if(!controller.signal.aborted){setResult(data);setError('');}}
      catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Checkout could not be updated.');}
    }
    void cancel();return()=>controller.abort();
  },[token,retry]);
  const title=result?.status==='expired'?'Checkout cancelled':result?.status==='paid'?'Payment already confirmed':'Checking checkout';
  return <PaymentShell title={title}>
    {!token?<p role="alert" className="mt-5 text-sm text-red-700">This cancellation link is missing or invalid.</p>:
      result?.status==='expired'?<p role="status" className="mt-5 text-sm leading-6 text-slate-600">The Stripe checkout was closed and the item is available again. You can return to the listing whenever you&apos;re ready.</p>:
      result?<p role="status" className="mt-5 text-sm leading-6 text-slate-600">A payment is already confirmed or being processed. The item will stay reserved or Sold while confirmation completes.</p>:
      !error?<p role="status" className="mt-5 flex items-center gap-2 text-sm text-slate-600"><LoaderCircle size={18} className="animate-spin"/> Closing checkout safely...</p>:null}
    {error&&<div role="alert" className="mt-5 text-sm text-red-700"><p>{error}</p><Button variant="outline" className="mt-4" onClick={()=>{setError('');setRetry(value=>value+1);}}>Try again</Button></div>}
    <Button asChild className="mt-6"><Link href={result?'/item/'+result.listingId:'/'}>{result?'Return to listing':'Browse Marketplace'}</Link></Button>
  </PaymentShell>;
}
