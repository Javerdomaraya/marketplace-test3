'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { ArrowLeft, CircleAlert, ImageIcon, Mail, MapPin, Tag } from 'lucide-react';
import { getPublicImageUrl, getSupabase } from '../../../lib/supabase';
import { formatDate, formatPrice } from '../../../lib/utils';
import { isUuid } from '../../../lib/validation';
import { MessageSellerForm } from '../../../components/marketplace/message-seller-form';
import { PurchasePanel } from '../../../components/marketplace/purchase-panel';
import type { Listing } from '../../../types/marketplace';

export default function ItemDetailPage() {
  return <Suspense fallback={<main className="mx-auto w-full max-w-[1500px] flex-1 px-5 py-20 text-sm text-slate-500">Loading listing...</main>}><ItemDetailContent/></Suspense>;
}

function ItemDetailContent() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isUuid(id)) { if (active) { setError('This listing link is invalid.'); setLoading(false); } return; }
      const supabase = getSupabase();
      if (!supabase) { if (active) { setError('Connect Supabase in .env.local to view this listing.'); setLoading(false); } return; }
      const { data, error: queryError } = await supabase.from('listings').select('id,title,description,price,category,seller_email,image_path,location,created_at,updated_at,status,sold_at').eq('id', id).maybeSingle();
      if (!active) return;
      setListing(data as Listing | null);
      setError(queryError ? queryError.message : data ? '' : 'This listing was not found. It may have been removed.');
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [id]);

  const imageUrl = listing ? getPublicImageUrl(listing.image_path) : null;

  return <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 pb-16 pt-6 sm:px-7">
    <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#1877F2] hover:underline"><ArrowLeft size={17}/> Back to Marketplace</Link>
    {loading ? <div aria-label="Loading listing" className="mt-7 grid animate-pulse gap-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,1fr)]"><div className="h-[min(65dvh,32rem)] min-h-64 rounded-xl bg-slate-200 lg:h-[calc(100dvh-10rem)] lg:min-h-0 lg:max-h-[42rem]"/><div className="space-y-5"><div className="h-8 w-1/2 rounded bg-slate-200"/><div className="h-12 rounded bg-slate-200"/><div className="h-28 rounded bg-slate-200"/></div></div> : error || !listing ? <div role="alert" className="mx-auto mt-20 max-w-lg rounded-xl border border-slate-200 bg-white p-10 text-center"><CircleAlert size={44} className="mx-auto text-amber-500"/><h1 className="mt-4 text-2xl font-extrabold">Listing unavailable</h1><p className="mt-3 text-sm text-slate-500">{error}</p><Link href="/" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#1877F2]"><ArrowLeft size={15}/> Browse listings</Link></div> : <div className="mt-6 grid items-start gap-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,1fr)] xl:gap-10">
      <section className="min-w-0 lg:sticky lg:top-24"><div className="relative flex h-[min(65dvh,32rem)] min-h-64 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm lg:h-[calc(100dvh-10rem)] lg:min-h-0 lg:max-h-[42rem]">{imageUrl ? <Image src={imageUrl} alt={listing.title} fill sizes="(min-width: 1024px) 55vw, 100vw" unoptimized className="object-contain"/> : <ImageIcon size={64} className="text-slate-300"/>}</div></section>
      <aside className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h1 className="break-words text-2xl font-extrabold leading-tight text-slate-900">{listing.title}</h1>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{formatPrice(Number(listing.price))}</p>
        <PurchasePanel key={listing.id} listingId={listing.id} sellerEmail={listing.seller_email} initialStatus={listing.status}/>
        <p className="mt-4 text-xs text-slate-500">Listed {formatDate(listing.created_at)}</p>
        {listing.location && <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14}/>{listing.location}</p>}
        <p className="mt-5 flex items-center gap-2 text-sm text-slate-600"><Tag size={16} className="text-slate-400"/><span>Category: {listing.category}</span></p>
        <div className="mt-5 border-t border-slate-200 pt-5"><h2 className="text-base font-extrabold text-slate-900">Description</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{listing.description}</p></div>
        <div className="mt-5 border-t border-slate-200 pt-5"><h2 className="text-base font-extrabold text-slate-900">Seller Information</h2><p className="mt-2 flex items-start gap-2 break-all text-sm text-slate-600"><Mail size={16} className="mt-0.5 shrink-0"/>{listing.seller_email}</p></div>
        <div className="mt-6"><MessageSellerForm listingId={listing.id}/></div>
      </aside>
    </div>}
  </main>;
}
