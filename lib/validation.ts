import { isCategory } from './categories';

export type ListingFields = {
  title: string;
  description: string;
  price: string;
  category: string;
  sellerEmail: string;
  location?: string;
};

export type BuyerMessageFields = { buyerEmail: string; message: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pricePattern = /^\d+(?:\.\d{1,2})?$/;

export function validateListing(fields: ListingFields): Partial<Record<keyof ListingFields, string>> {
  const errors: Partial<Record<keyof ListingFields, string>> = {};
  const title = fields.title.trim();
  const description = fields.description.trim();
  if (title.length < 3 || title.length > 100) errors.title = 'Use 3–100 characters for the title.';
  if (description.length < 10 || description.length > 2000) errors.description = 'Use 10–2000 characters for the description.';
  if (!pricePattern.test(fields.price.trim()) || !Number.isFinite(Number(fields.price)) || Number(fields.price) <= 0 || Number(fields.price) > 100000000) {
    errors.price = 'Enter a price above 0, up to 100,000,000, with at most 2 decimals.';
  }
  if (!isCategory(fields.category)) errors.category = 'Select a category.';
  if (!emailPattern.test(fields.sellerEmail.trim()) || fields.sellerEmail.trim().length > 254) errors.sellerEmail = 'Enter a valid email address.';
  if (fields.location?.trim() && (fields.location.trim().length < 2 || fields.location.trim().length > 100)) errors.location = 'Use 2–100 characters for the location.';
  return errors;
}

export function validateBuyerMessage(fields: BuyerMessageFields): Partial<Record<keyof BuyerMessageFields, string>> {
  const errors: Partial<Record<keyof BuyerMessageFields, string>> = {};
  if (!emailPattern.test(fields.buyerEmail.trim()) || fields.buyerEmail.trim().length > 254) errors.buyerEmail = 'Enter a valid email address.';
  if (fields.message.trim().length < 1 || fields.message.trim().length > 2000) errors.message = 'Your message must be 1–2000 characters.';
  return errors;
}

export function validatePhoto(file: { type: string; size: number }): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Use a JPG, PNG, or WebP image.';
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) return 'Choose an image under 5 MB.';
  return null;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
