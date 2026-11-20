import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { SiteHeader } from '../components/layout/site-header';
import { SiteFooter } from '../components/layout/site-footer';
import './globals.css';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Marketplace — Discover something great',
  description: 'Buy and sell items in a community-powered marketplace.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={`${geist.className} flex min-h-screen flex-col bg-[#f2f3f5] text-slate-900 antialiased`}><SiteHeader/>{children}<SiteFooter/></body></html>;
}
