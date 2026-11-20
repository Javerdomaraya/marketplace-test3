import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
export function PaymentShell({title,children}:{title:string;children:React.ReactNode}) {
  return <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
    <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#1877F2]"><ArrowLeft size={16}/> Back to Marketplace</Link>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800"><ShieldCheck size={14}/> Sandbox only · No real money</p>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
      {children}
    </section>
  </main>;
}
