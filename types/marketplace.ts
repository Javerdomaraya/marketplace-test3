import type { Category } from '../lib/categories';

export type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: Category;
  seller_email: string;
  location: string | null;
  image_path: string;
  created_at: string;
  updated_at: string;
  status?: 'available' | 'reserved' | 'sold';
  sold_at?: string | null;
};
