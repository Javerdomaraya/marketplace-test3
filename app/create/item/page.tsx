'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, ImagePlus, LoaderCircle, MapPin, ShieldCheck, X } from 'lucide-react';
import { CATEGORIES } from '../../../lib/categories';
import { getSupabase } from '../../../lib/supabase';
import { formatPrice } from '../../../lib/utils';
import { type ListingFields, validateListing, validatePhoto } from '../../../lib/validation';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';

const empty: ListingFields = { title: '', description: '', price: '', sellerEmail: '', category: '', location: '' };

export default function CreateListingPage() {
  const router = useRouter();
  const [fields, setFields] = useState<ListingFields>(empty);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof ListingFields | 'photo', string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const submissionLock = useRef(false);
  const draftVersion = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // Cache Components hides routes instead of unmounting them. Leaving this
  // creation flow starts a new draft, including its file input and feedback.
  useLayoutEffect(() => () => {
    draftVersion.current += 1;
    submissionLock.current = false;
    setFields(empty);
    setPhoto(null);
    setPreview(null);
    setErrors({});
    setServerError('');
    setSubmitting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  function setField(field: keyof ListingFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function changePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
    setErrors((current) => ({ ...current, photo: file ? validatePhoto(file) ?? undefined : undefined }));
  }

  function removePhoto() {
    setPhoto(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current) return;
    const issues: Partial<Record<keyof ListingFields | 'photo', string>> = validateListing(fields);
    const photoIssue = photo ? validatePhoto(photo) : 'Please upload a product photo.';
    if (photoIssue) issues.photo = photoIssue;
    setErrors(issues);
    if (Object.keys(issues).length) return;

    const supabase = getSupabase();
    if (!supabase || !photo) { setServerError('Supabase is not connected. Configure .env.local and restart the server.'); return; }
    submissionLock.current = true;
    const submittedVersion = draftVersion.current;
    setSubmitting(true);
    setServerError('');
    try {
      const extension = photo.type === 'image/jpeg' ? 'jpg' : photo.type === 'image/png' ? 'png' : 'webp';
      const path = crypto.randomUUID() + '.' + extension;
      const { error: uploadError } = await supabase.storage.from('listing-images').upload(path, photo, { upsert: false, contentType: photo.type, cacheControl: '3600' });
      if (uploadError) throw new Error('Photo upload failed: ' + uploadError.message);
      const { data, error: createError } = await supabase.from('listings').insert({
        title: fields.title.trim(),
        description: fields.description.trim(),
        price: Number(fields.price),
        seller_email: fields.sellerEmail.trim(),
        category: fields.category,
        location: fields.location?.trim() || null,
        image_path: path,
      }).select('id').single();
      if (createError || !data) throw new Error('Could not save listing: ' + (createError?.message ?? 'No record returned'));
      if (submittedVersion === draftVersion.current) router.push('/item/' + data.id);
    } catch (error) {
      if (submittedVersion === draftVersion.current) {
        setServerError(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
      }
    } finally {
      if (submittedVersion === draftVersion.current) {
        submissionLock.current = false;
        setSubmitting(false);
      }
    }
  }

  const priceText = fields.price && Number.isFinite(Number(fields.price)) && Number(fields.price) > 0 ? formatPrice(Number(fields.price)) : 'Price';

  return (
    <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 pb-16 pt-6 sm:px-7">
      <Link href="/create" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#1877F2]"><ArrowLeft size={17}/> Back to listing types</Link>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(340px,440px)_minmax(0,1fr)] xl:gap-8">
        <form onSubmit={submit} noValidate className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Create new listing</h1>
          <p className="mt-1 text-sm text-slate-500">Fill in the details below to publish your item.</p>
          <div className="mt-7 space-y-5">
            <div>
              <label htmlFor="photo" className="mb-2 block text-sm font-semibold text-slate-800">Photo <span className="text-red-500">*</span></label>
              <input ref={fileInputRef} className="sr-only" id="photo" type="file" tabIndex={-1} accept="image/jpeg,image/png,image/webp" onChange={changePhoto} aria-describedby="photo-help"/>
              {preview ? <div className="relative h-40 overflow-hidden rounded-lg border border-slate-200 bg-slate-100"><Image src={preview} alt="Selected photo" fill unoptimized className="object-contain"/><button type="button" onClick={removePhoto} aria-label="Remove selected photo" className="absolute right-2 top-2 rounded-full bg-red-500 p-1.5 text-white"><X size={17}/></button></div> : <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-[#1877F2] hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1877F2]"><ImagePlus size={28} className="text-slate-400"/><span className="mt-2 text-sm font-semibold text-slate-700">Add photo</span></button>}
              {preview && <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 inline-block rounded text-xs font-semibold text-[#1877F2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1877F2]">Change photo</button>}
              <p id="photo-help" className="mt-2 text-xs leading-5 text-slate-500">One JPG, PNG, or WebP, up to 5 MB. Use a photo with the item clearly in frame.</p>
              {errors.photo && <p role="alert" className="mt-2 text-xs text-red-600">{errors.photo}</p>}
            </div>
            <Field label="Title" name="title" error={errors.title} required><Input id="title" placeholder="What are you selling?" maxLength={100} value={fields.title} onChange={(e) => setField('title', e.target.value)} required/></Field>
            <Field label="Category" name="category" error={errors.category} required><select id="category" required value={fields.category} onChange={(e) => setField('category', e.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-[#1877F2] focus:ring-4 focus:ring-blue-100"><option value="">Select a category</option>{CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}</select></Field>
            <Field label="Price (USD)" name="price" error={errors.price} required><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">$</span><Input id="price" inputMode="decimal" placeholder="0.00" className="pl-9" value={fields.price} onChange={(e) => setField('price', e.target.value)} required/></div></Field>
            <Field label="Location (optional)" name="location" error={errors.location}><Input id="location" maxLength={100} placeholder="City, province, country" aria-describedby="location-help" value={fields.location ?? ''} onChange={(e) => setField('location', e.target.value)}/><p id="location-help" className="mt-2 text-xs leading-5 text-slate-500">City or area only, e.g. Cebu City, Cebu, Philippines.</p></Field>
            <Field label="Contact Email" name="sellerEmail" error={errors.sellerEmail} required><Input id="sellerEmail" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} value={fields.sellerEmail} onChange={(e) => setField('sellerEmail', e.target.value)} required/></Field>
            <Field label="Description" name="description" error={errors.description} required><Textarea id="description" placeholder="Describe your item, condition, and anything buyers should know..." maxLength={2000} value={fields.description} onChange={(e) => setField('description', e.target.value)} required className="min-h-32"/></Field>
            {serverError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{serverError}</div>}
            <Button type="submit" disabled={submitting} className="w-full rounded-lg">{submitting ? <><LoaderCircle size={17} className="animate-spin"/> Publishing...</> : <><Check size={17}/> Create Listing</>}</Button>
            <p className="flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck size={16} className="shrink-0 text-[#1877F2]"/> Contact email is public. Your listing will be visible to everyone.</p>
            <Link href={'/connect'+(fields.sellerEmail.trim()?'?email='+encodeURIComponent(fields.sellerEmail.trim()):'')} className="inline-block text-xs font-semibold text-[#1877F2] hover:underline">Enable Buy Now for your listings: Connect with Stripe</Link>
          </div>
        </form>

        <section className="min-w-0 lg:sticky lg:top-24">
          <h2 className="mb-4 text-lg font-extrabold text-slate-900">Preview</h2>
          <div role="region" aria-label="Listing preview" tabIndex={0} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1877F2] lg:max-h-[calc(100dvh-10rem)] lg:overflow-y-auto xl:grid xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] xl:bg-[#f0f2f5]">
            <div className="relative flex h-56 items-center justify-center border-b border-slate-200 bg-[#f0f2f5] sm:h-64 lg:h-52 xl:sticky xl:top-0 xl:h-80 xl:border-b-0 xl:border-r">{preview ? <Image src={preview} alt="Live preview of your selected item" fill unoptimized sizes="(min-width: 1280px) 420px, (min-width: 1024px) 50vw, 100vw" className="object-contain"/> : <div className="flex flex-col items-center gap-2 text-slate-400"><ImagePlus size={40}/><span className="text-sm">Your photo will appear here</span></div>}</div>
            <div className="space-y-5 bg-white p-5 sm:p-6">
              <div><h3 className="break-words text-2xl font-extrabold text-slate-900">{fields.title.trim() || 'Title'}</h3><p className="mt-2 text-2xl font-bold text-slate-900">{priceText}</p><p className="mt-3 text-sm text-slate-500">Listed just now</p>{fields.location?.trim() && <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14}/>{fields.location.trim()}</p>}</div>
              {fields.category && <p className="text-sm text-slate-600"><span className="font-semibold">Category:</span> {fields.category}</p>}
              <div><h4 className="mb-2 text-sm font-bold text-slate-900">Description</h4><p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{fields.description.trim() || 'Your description will appear here.'}</p></div>
              <div><h4 className="mb-2 text-sm font-bold text-slate-900">Seller Information</h4><p className="break-all text-sm text-slate-600">{fields.sellerEmail.trim() || 'Your contact email will appear here.'}</p></div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, error, name, children, required = false }: { label: string; error?: string; name: string; children: React.ReactNode; required?: boolean }) {
  return <div><label htmlFor={name} className="mb-2 block text-sm font-semibold text-slate-800">{label} {required && <span className="text-red-500">*</span>}</label>{children}{error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}</div>;
}
