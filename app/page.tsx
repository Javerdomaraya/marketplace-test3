'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CircleAlert, PackageOpen, Plus, Search, Tag } from 'lucide-react';
import { CATEGORIES } from '../lib/categories';
import { loadAllListings } from '../lib/listing-pagination';
import { getSupabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ListingCard } from '../components/marketplace/listing-card';
import type { Listing } from '../types/marketplace';

export default function Home() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [category, setCategory] = useState('All Categories');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = getSupabase();
      if (!supabase) {
        if (active) { setError('Connect your Supabase project in .env.local to load real listings.'); setLoading(false); }
        return;
      }
      try {
        const rows = await loadAllListings<Listing>(async (from, to) => {
          const { data, error: queryError } = await supabase.from('listings')
            .select('id,title,description,price,category,seller_email,image_path,location,created_at,updated_at,status,sold_at')
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(from, to);
          return { data: data as Listing[] | null, error: queryError };
        });
        if (!active) return;
        setError('');
        setListings(rows);
      } catch (cause) {
        if (active) {
          setError('Unable to load listings: ' + (cause instanceof Error ? cause.message : 'Please try again.'));
          setListings([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [retry]);

  const visible = useMemo(() => listings.filter((item) =>
    (category === 'All Categories' || item.category === category) &&
    (item.title + ' ' + item.description + ' ' + (item.location ?? '')).toLowerCase().includes(search.trim().toLowerCase())
  ), [listings, category, search]);

  function retryLoad() { setLoading(true); setError(''); setRetry((value) => value + 1); }

  const allCategories = ['All Categories', ...CATEGORIES];
  const headline = search.trim() ? 'Search results' : category === 'All Categories' ? "Today's picks" : category;

  return (
    <div className="mx-auto grid w-full max-w-[1760px] flex-1 gap-5 px-4 pb-16 pt-6 sm:px-7 lg:grid-cols-[240px_minmax(0,1fr)] xl:gap-7">
      <aside className="hidden lg:block">
        <div className="sticky top-[88px] max-h-[calc(100vh-110px)] overflow-y-auto pr-2">
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-extrabold text-slate-900">Create new listing</h2>
            <Button asChild className="w-full rounded-lg"><Link href="/create"><Plus size={16}/> Choose listing type</Link></Button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <h2 className="px-2 pb-3 pt-2 text-base font-extrabold text-slate-900">Categories</h2>
            <nav aria-label="Categories" className="space-y-0.5">{allCategories.map((cat) => <button key={cat} onClick={() => setCategory(cat)} aria-pressed={category === cat} className={'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium transition ' + (category === cat ? 'bg-blue-100 text-blue-700' : 'text-slate-700 hover:bg-slate-100')}><span>{cat}</span>{category === cat && <ArrowRight size={14}/>}</button>)}</nav>
          </div>
        </div>
      </aside>

      <main className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="text-[25px] font-extrabold tracking-tight text-slate-900">{headline}</h1><p className="text-xs font-medium text-slate-500">{loading ? 'Loading listings...' : visible.length + (visible.length === 1 ? ' listing' : ' listings')}</p></div>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><Input aria-label="Search listings" placeholder="Search listings..." className="h-11 rounded-lg pl-11" value={search} onChange={(e) => setSearch(e.target.value)}/></div><Button variant="outline" className="h-11 rounded-lg" onClick={() => { setSearch(''); setCategory('All Categories'); }}><Tag size={16}/> Clear filters</Button></div>
        <div className="mb-5 flex gap-2 overflow-x-auto pb-2 lg:hidden" aria-label="Category filters">{allCategories.map((cat) => <button key={cat} onClick={() => setCategory(cat)} aria-pressed={category === cat} className={'shrink-0 rounded-full px-4 py-2 text-xs font-semibold ' + (category === cat ? 'bg-[#1877F2] text-white' : 'border border-slate-200 bg-white text-slate-600')}>{cat}</button>)}</div>
        {loading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" aria-label="Loading listings">{Array.from({ length: 10 }, (_, i) => <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="aspect-square bg-slate-200"/><div className="space-y-3 p-3"><div className="h-5 w-1/2 rounded bg-slate-100"/><div className="h-4 rounded bg-slate-100"/></div></div>)}</div> : error ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center"><CircleAlert className="mx-auto text-amber-600" size={32}/><h2 className="mt-3 font-bold text-slate-900">Listings unavailable</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{error}</p><Button variant="outline" size="sm" className="mt-5" onClick={retryLoad}>Try again</Button></div> : visible.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{visible.map((listing) => <ListingCard key={listing.id} listing={listing}/>)}</div> : <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><span className="mb-4 flex size-14 items-center justify-center rounded-full bg-blue-50 text-[#1877F2]"><PackageOpen size={27}/></span><h2 className="text-lg font-extrabold text-slate-900">No listings found</h2><p className="mt-2 text-sm text-slate-500">{search || category !== 'All Categories' ? 'Try a different search or category.' : 'Create the first real listing to get started.'}</p><Button asChild className="mt-5"><Link href="/create"><Plus size={16}/> Create listing</Link></Button></div>}
      </main>
    </div>
  );
}
