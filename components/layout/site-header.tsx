import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '../ui/button';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-[1760px] items-center justify-between gap-4 px-4 sm:px-7">
        <Link href="/" aria-label="Marketplace home" className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1877F2] text-2xl font-black text-white">F</span>
          <strong className="text-xl font-bold tracking-tight text-slate-950">Marketplace</strong>
        </Link>
        <nav aria-label="Marketplace navigation" className="flex items-center gap-2 sm:gap-4">
          <Link href="/" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 sm:block">Browse</Link>
          <Link href="/connect" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-[#1877F2] hover:bg-blue-50 md:block">Connect with Stripe</Link>
          <Button asChild size="sm" className="rounded-lg"><Link href="/create"><Plus size={17}/> Create listing</Link></Button>
        </nav>
      </div>
    </header>
  );
}
