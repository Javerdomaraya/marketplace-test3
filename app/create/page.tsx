import Link from 'next/link';
import { ArrowLeft, ArrowRight, CarFront, House, Layers3, Package, Tag } from 'lucide-react';

const listingTypes = [
  { name: 'Item for sale', note: 'Sell a product to people in your community.', icon: Package, href: '/create/item', available: true },
  { name: 'Create multiple listings', note: 'Batch listing is not part of this assessment.', icon: Layers3, href: '', available: false },
  { name: 'Vehicle for sale', note: 'Dedicated vehicle fields are coming later.', icon: CarFront, href: '', available: false },
  { name: 'Home for sale or rent', note: 'Real estate listings are coming later.', icon: House, href: '', available: false },
];

export default function CreateTypePage() {
  return (
    <main className="mx-auto grid w-full max-w-[1440px] flex-1 gap-6 px-4 py-8 sm:px-7 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-slate-200 bg-white p-5 lg:self-start">
        <Link href="/" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#1877F2]"><ArrowLeft size={16}/> Marketplace</Link>
        <h1 className="text-lg font-extrabold text-slate-900">Create new listing</h1>
        <p className="mt-2 text-xs leading-5 text-slate-500">Choose how you want to sell.</p>
        <Link href="/connect" className="mt-4 inline-block text-sm font-semibold text-[#1877F2] hover:underline">Connect with Stripe</Link>
        <div className="mt-6 flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-3 text-sm font-bold text-[#1877F2]"><Tag size={17}/> Choose listing type</div>
      </aside>
      <section className="flex min-h-[55vh] flex-col justify-center py-8 lg:py-12">
        <div className="mb-8 text-center"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#1877F2]">Start selling</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">Choose listing type</h2><p className="mt-3 text-sm text-slate-500">What would you like to list on Marketplace?</p></div>
        <div className="mx-auto grid w-full max-w-[940px] gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {listingTypes.map((type) => {
            const Icon = type.icon;
            const inner = <><span className="mb-5 flex size-16 items-center justify-center rounded-full bg-slate-100 text-slate-600"><Icon size={29} strokeWidth={1.8}/></span><strong className="text-center text-base font-bold leading-5 text-slate-900">{type.name}</strong><span className="mt-3 text-center text-xs leading-5 text-slate-500">{type.note}</span>{type.available ? <span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[#1877F2]">Continue <ArrowRight size={14}/></span> : <span className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Coming later</span>}</>;
            return type.available ? <Link key={type.name} href={type.href} className="flex min-h-[235px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-400 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-[#1877F2]">{inner}</Link> : <div key={type.name} aria-disabled="true" className="flex min-h-[235px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-5 opacity-70">{inner}</div>;
          })}
        </div>
      </section>
    </main>
  );
}
