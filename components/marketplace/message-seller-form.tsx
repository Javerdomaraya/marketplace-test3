'use client';

import { useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, LoaderCircle, Send } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import { validateBuyerMessage } from '../../lib/validation';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

export function MessageSellerForm({ listingId }: { listingId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const issues = validateBuyerMessage({ buyerEmail, message });
    if (issues.buyerEmail || issues.message) { setError(issues.buyerEmail ?? issues.message ?? 'Invalid message'); return; }
    const supabase = getSupabase();
    if (!supabase) { setError('Supabase is not connected. Please configure .env.local.'); return; }
    lock.current = true;
    setSubmitting(true);
    setError('');
    try {
      const { error: insertError } = await supabase.from('messages').insert({ listing_id: listingId, buyer_email: buyerEmail.trim(), message: message.trim() });
      if (insertError) throw new Error(insertError.message);
      setSuccess(true);
      setMessage('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to send your message.');
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  }

  return <section className="border-t border-slate-200 pt-6">
    <h2 className="text-base font-extrabold text-slate-900">Message Seller</h2>
    <p className="mt-2 text-xs leading-5 text-slate-500">Ask a question or express interest. Messages are saved privately in the marketplace database.</p>
    {success ? <div role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 p-5 text-green-800"><CheckCircle2 size={25}/><p className="mt-2 text-sm font-bold">Message submitted successfully</p><p className="mt-1 text-xs leading-5">Your message was saved. If seller email notifications are configured, they are sent separately and may arrive later.</p><button className="mt-3 text-xs font-bold underline" onClick={() => { setSuccess(false); setError(''); setExpanded(true); }}>Send another message</button></div> : <>
      <Button type="button" className="mt-4 w-full rounded-lg" variant={expanded ? 'outline' : 'default'} aria-expanded={expanded} aria-controls={expanded ? 'message-seller-form' : undefined} onClick={() => setExpanded((current) => !current)}>{expanded ? 'Hide message form' : 'Message Seller'}</Button>
      {expanded && <form id="message-seller-form" onSubmit={submit} noValidate className="mt-4 space-y-3"><div><label htmlFor="buyer-email" className="mb-1.5 block text-sm font-medium">Your Email</label><Input id="buyer-email" type="email" placeholder="you@example.com" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} maxLength={254} autoComplete="email" required className="h-10 rounded-lg"/></div><div><label htmlFor="buyer-message" className="mb-1.5 block text-sm font-medium">Message</label><Textarea id="buyer-message" placeholder="Hi! Is this item still available?" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} required className="min-h-28 rounded-lg"/></div>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}<Button type="submit" className="w-full rounded-lg" disabled={submitting}>{submitting ? <><LoaderCircle className="animate-spin" size={16}/> Sending...</> : <><Send size={16}/> Send Message</>}</Button></form>}
    </>}
    <p className="mt-3 text-xs leading-5 text-slate-400">Never send payment details or passwords in messages.</p>
  </section>;
}
