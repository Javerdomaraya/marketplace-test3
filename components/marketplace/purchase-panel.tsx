'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CreditCard, LoaderCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { paymentJson } from '../../lib/payment-client';
type Availability={status:'available'|'reserved'|'sold';canBuy:boolean;sellerReady:boolean;eligiblePrice:boolean};
export function PurchasePanel({listingId,sellerEmail,initialStatus}:{listingId:string;sellerEmail:string;initialStatus?:string}) {
  const [availability,setAvailability]=useState<Availability|null>(null);const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');const [buying,setBuying]=useState(false);const [retry,setRetry]=useState(0);
  const checkout=useRef<AbortController|null>(null);const lock=useRef(false);
  useEffect(()=>{
    const controller=new AbortController();
    async function load() {
      try {const data=await paymentJson<Availability>(await fetch('/api/stripe/status?listingId='+encodeURIComponent(listingId),{cache:'no-store',signal:controller.signal}));if(!controller.signal.aborted){setAvailability(data);setError('');}}
      catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Purchases are temporarily unavailable.');}
      finally{if(!controller.signal.aborted)setLoading(false);}
    }
    void load();
    return ()=>{controller.abort();checkout.current?.abort();lock.current=false;setBuying(false);};
  },[listingId,retry]);
  async function buy() {
    if(lock.current)return;lock.current=true;setBuying(true);setError('');
    const controller=new AbortController();checkout.current=controller;
    try {
      const result=await paymentJson<{url:string}>(await fetch('/api/stripe/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({listingId}),signal:controller.signal}));
      if(!controller.signal.aborted)window.location.assign(result.url);
    } catch(cause){if(!controller.signal.aborted){setError(cause instanceof Error?cause.message:'Checkout could not be opened.');setAvailability(null);}}
    finally{if(!controller.signal.aborted){lock.current=false;setBuying(false);}}
  }
  function reload(){setLoading(true);setError('');setRetry(value=>value+1);}
  const sold=initialStatus==='sold'||availability?.status==='sold';
  return <section aria-label="Purchase item" className="mt-6 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
    {sold?<div role="status" className="flex items-center gap-2 font-bold text-slate-700"><CheckCircle2 size={20}/> Sold</div>:
      loading?<p role="status" className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin"/> Checking payment availability...</p>:
      availability?.status==='reserved'?<p role="status" className="text-sm font-semibold text-amber-800">Checkout in progress. This item is temporarily reserved.</p>:
      availability?.canBuy?<Button type="button" onClick={buy} disabled={buying} className="w-full">{buying?<><LoaderCircle size={17} className="animate-spin"/> Opening Checkout...</>:<><CreditCard size={18}/> Buy Now</>}</Button>:
      availability&&!availability.sellerReady?<p className="text-sm text-slate-600">The seller hasn&apos;t enabled payments for this item yet.</p>:
      availability&&!availability.eligiblePrice?<p className="text-sm text-slate-600">Buy Now supports USD prices from $0.50 to $999,999.99.</p>:null}
    {error&&<div role="alert" className="mt-3 text-sm text-red-700"><p>{error}</p><button type="button" onClick={reload} className="mt-2 font-semibold underline">Check again</button></div>}
    <p className="mt-3 text-xs text-slate-500">Sandbox checkout · No real money is charged.</p>
    {!sold&&<Link href={'/connect?email='+encodeURIComponent(sellerEmail)} className="mt-2 inline-block text-xs font-semibold text-[#1877F2]">Seller? Connect with Stripe</Link>}
  </section>;
}
