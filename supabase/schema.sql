-- Greg's Test 3 Marketplace. Run in a NEW Supabase project's SQL Editor.
-- Anonymous visitors can browse/create listings and INSERT messages, but never READ messages.

create extension if not exists pgcrypto;

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 100),
  description text not null check (char_length(btrim(description)) between 10 and 2000),
  price numeric(12,2) not null check (price > 0 and price <= 100000000),
  category text not null,
  seller_email text not null check (
    char_length(seller_email) <= 254
    and seller_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  image_path text not null check (
    image_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Re-running this script also upgrades an earlier Test 3 database to the
-- screenshot-inspired category list and the optional seller-entered location.
alter table public.listings add column if not exists location text;
alter table public.listings drop constraint if exists listings_category_check;
alter table public.listings add constraint listings_category_check check (
  category in (
    'Vehicles','Property Rentals','Apparel','Classifieds','Electronics',
    'Entertainment','Family','Free Stuff','Garden & Outdoor','Hobbies',
    'Home Goods','Home Improvement','Home Sales','Musical Instruments',
    'Office Supplies','Pet Supplies','Sporting Goods','Toys & Games',
    'Buy and sell groups','Furniture','Home & Garden','Fashion','Sports','Other'
  )
);
alter table public.listings drop constraint if exists listings_location_check;
alter table public.listings add constraint listings_location_check check (
  location is null or char_length(btrim(location)) between 2 and 100
);

create index if not exists listings_created_at_idx on public.listings(created_at desc, id desc);
create index if not exists listings_category_created_at_idx on public.listings(category, created_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_email text not null check (
    char_length(buyer_email) <= 254
    and buyer_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_listing_created_at_idx on public.messages(listing_id, created_at desc);

alter table public.listings enable row level security;
alter table public.messages enable row level security;

revoke all on public.listings from public, anon, authenticated;
revoke all on public.messages from public, anon, authenticated;
grant select, insert on public.listings to anon, authenticated;
grant insert on public.messages to anon, authenticated;

drop policy if exists "Browse listings" on public.listings;
create policy "Browse listings" on public.listings for select to anon, authenticated using (true);
drop policy if exists "Create listings" on public.listings;
create policy "Create listings" on public.listings for insert to anon, authenticated with check (true);

drop policy if exists "Send private messages" on public.messages;
create policy "Send private messages" on public.messages for insert to anon, authenticated with check (true);
-- Intentionally NO SELECT, UPDATE or DELETE policy on messages.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Upload marketplace images" on storage.objects;
create policy "Upload marketplace images" on storage.objects
for insert to anon, authenticated
with check (
  bucket_id = 'listing-images'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
);
-- No anonymous overwrite/delete; bucket is public to serve image URLs.
