import Link from 'next/link';
import Image from 'next/image';
import { ImageIcon, MapPin } from 'lucide-react';
import { getPublicImageUrl } from '../../lib/supabase';
import { formatPrice } from '../../lib/utils';
import type { Listing } from '../../types/marketplace';

export function ListingCard({ listing }: { listing: Listing }) {
  const url = getPublicImageUrl(listing.image_path);
  return (
    <Link href={'/item/' + listing.id} className="group min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1877F2]">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        {url ? <Image src={url} alt={listing.title} fill unoptimized sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 20vw" className="object-cover transition-transform duration-200 group-hover:scale-[1.025]"/> : <div className="flex size-full items-center justify-center text-slate-300"><ImageIcon size={38}/></div>}
      </div>
      <div className="space-y-1 px-3 pb-3 pt-3">
        <p className="text-lg font-extrabold tracking-tight text-slate-950">{formatPrice(Number(listing.price))}</p>
        <h3 className="line-clamp-2 min-h-9 text-sm font-medium leading-5 text-slate-800">{listing.title}</h3>
        <p className="line-clamp-1 text-xs text-slate-500">{listing.category}</p>
        <p className="flex items-center gap-1 truncate text-xs text-slate-500">{listing.location ? <><MapPin size={12} className="shrink-0"/> {listing.location}</> : 'Listed recently'}</p>
      </div>
    </Link>
  );
}
