export const CATEGORIES = [
  'Vehicles',
  'Property Rentals',
  'Apparel',
  'Classifieds',
  'Electronics',
  'Entertainment',
  'Family',
  'Free Stuff',
  'Garden & Outdoor',
  'Hobbies',
  'Home Goods',
  'Home Improvement',
  'Home Sales',
  'Musical Instruments',
  'Office Supplies',
  'Pet Supplies',
  'Sporting Goods',
  'Toys & Games',
  'Buy and sell groups',
  'Furniture',
  'Home & Garden',
  'Fashion',
  'Sports',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: string): value is Category {
  return CATEGORIES.some((category) => category === value);
}
