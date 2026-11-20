'use client';
import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, CheckCircle2, LoaderCircle } from 'lucide-react';
import { PaymentShell } from '../../components/payments/payment-shell';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { paymentJson } from '../../lib/payment-client';
export default function ConnectPage() {
  return <Suspense fallback={<PaymentShell title="Connect with Stripe"><p className="mt-4 text-sm text-slate-500">Loading seller setup...</p></PaymentShell>}><ConnectContent/></Suspense>;
}
function ConnectContent() {
  const params=useSearchParams();
  return <ConnectForm key={params.get('email')??'default'} initialEmail={params.get('email')??''} status={params.get('status')??''}/>;
}
function ConnectForm({initialEmail,status}:{initialEmail:string;status:string}) {
  const [email,setEmail]=useState(initialEmail);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const request=useRef<AbortController|null>(null);const lock=useRef(false);
  useEffect(()=>()=>{request.current?.abort();lock.current=false;setBusy(false);setError('');},[]);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');
    const controller=new AbortController();request.current=controller;
    try {
      const result=await paymentJson<{url:string}>(await fetch('/api/stripe/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email}),signal:controller.signal}));
      if(!controller.signal.aborted)window.location.assign(result.url);
    } catch(cause) { if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Seller setup could not be started.'); }
    finally { if(!controller.signal.aborted){lock.current=false;setBusy(false);} }
  }
  return <PaymentShell title="Connect with Stripe">
    <p className="mt-3 text-sm leading-6 text-slate-600">Enable sandbox purchases for your listings. Enter the same email you used when creating them, then complete Stripe&apos;s hosted seller setup.</p>
    {status==='complete'&&<div role="status" className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"><CheckCircle2 size={21} className="mb-2"/>Stripe confirmed that your account can accept sandbox payments. Your matching available listings can now show Buy Now.</div>}
    {status==='pending'&&<p role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">Stripe still needs more information or time to enable payments. Enter your seller email below to continue setup.</p>}
    <form onSubmit={submit} className="mt-7 space-y-4">
      <div><label htmlFor="seller-connect-email" className="mb-2 block text-sm font-semibold">Seller email</label><Input id="seller-connect-email" type="email" autoComplete="email" maxLength={254} required placeholder="Same email as your listing" value={email} onChange={event=>setEmail(event.target.value)}/></div>
      {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">{busy?<><LoaderCircle size={17} className="animate-spin"/> Opening Stripe...</>:<>Connect with Stripe <ArrowUpRight size={17}/></>}</Button>
    </form>
    <div className="mt-7 border-t border-slate-200 pt-5 text-xs leading-6 text-slate-500"><p>No marketplace login is required for this assessment. Use Stripe&apos;s sandbox identity and bank test data during onboarding.</p><p className="mt-2">The marketplace application fee is 10% of each purchase. Stripe processing fees may also apply within the sandbox simulation.</p></div>
  </PaymentShell>;
}
