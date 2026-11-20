-- Test 4 additive migration. Run AFTER supabase/schema.sql in the Marketplace project.
-- No credentials belong in SQL. Payment tables/RPCs are server-only.
begin;

create table if not exists public.marketplace_sellers (
  email text primary key check (email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  stripe_account_id text not null unique check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  app_id text not null,
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.marketplace_sellers enable row level security;
revoke all on public.marketplace_sellers from public, anon, authenticated;
grant all on public.marketplace_sellers to service_role;

alter table public.listings add column if not exists status text not null default 'available';
alter table public.listings add column if not exists sold_at timestamptz;
alter table public.listings add column if not exists reservation_order_id uuid;
alter table public.listings drop constraint if exists listings_payment_status_check;
alter table public.listings add constraint listings_payment_status_check check (status in ('available','reserved','sold'));

create table if not exists public.marketplace_orders (
  id uuid primary key,
  listing_id uuid not null references public.listings(id),
  listing_title text not null,
  seller_email text not null references public.marketplace_sellers(email),
  stripe_account_id text not null,
  amount_cents bigint not null check (amount_cents between 50 and 99999999),
  fee_cents bigint not null check (fee_cents >= 0 and fee_cents <= amount_cents),
  currency text not null default 'usd' check (currency = 'usd'),
  status text not null default 'pending' check (status in ('pending','paid','expired')),
  stripe_checkout_session_id text unique check (stripe_checkout_session_id like 'cs_test_%'),
  stripe_payment_intent_id text unique,
  buyer_email text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint marketplace_paid_fields_check check (status <> 'paid' or
    (stripe_checkout_session_id is not null and stripe_payment_intent_id is not null and paid_at is not null))
);
create index if not exists marketplace_orders_listing_idx on public.marketplace_orders(listing_id, created_at desc);
alter table public.marketplace_orders enable row level security;
revoke all on public.marketplace_orders from public, anon, authenticated;
grant all on public.marketplace_orders to service_role;
grant select, insert, update on public.listings to service_role;
grant usage on schema public to service_role;

alter table public.listings drop constraint if exists listings_reservation_order_fk;
alter table public.listings add constraint listings_reservation_order_fk
  foreign key (reservation_order_id) references public.marketplace_orders(id);
alter table public.listings drop constraint if exists listings_reservation_state_check;
alter table public.listings add constraint listings_reservation_state_check
  check ((status = 'reserved') = (reservation_order_id is not null));
alter table public.listings drop constraint if exists listings_sold_state_check;
alter table public.listings add constraint listings_sold_state_check
  check ((status = 'sold') = (sold_at is not null));

-- Public browsing includes display status, but never exposes internal order IDs.
revoke select on public.listings from anon, authenticated;
grant select (id,title,description,price,category,seller_email,image_path,location,created_at,updated_at,status,sold_at)
  on public.listings to anon, authenticated;
drop policy if exists "Create listings" on public.listings;
create policy "Create listings" on public.listings for insert to anon, authenticated
  with check (status = 'available' and sold_at is null and reservation_order_id is null);

create or replace function public.reserve_marketplace_order(p_listing_id uuid, p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  item public.listings%rowtype;
  seller public.marketplace_sellers%rowtype;
  purchase public.marketplace_orders%rowtype;
  cents bigint;
begin
  select * into item from public.listings where id = p_listing_id for update;
  if not found then raise exception 'Listing not found'; end if;
  if item.status = 'sold' then raise exception 'This item is sold'; end if;
  if item.status = 'reserved' then raise exception 'This item is already reserved by another checkout'; end if;
  select * into seller from public.marketplace_sellers where email = lower(btrim(item.seller_email));
  if not found or not (seller.details_submitted and seller.charges_enabled and seller.payouts_enabled)
    then raise exception 'The seller has not enabled payments'; end if;
  cents := round(item.price * 100);
  if cents < 50 or cents > 99999999 then raise exception 'This listing price cannot be purchased with Checkout'; end if;
  insert into public.marketplace_orders(id,listing_id,listing_title,seller_email,stripe_account_id,amount_cents,fee_cents)
    values(p_order_id,item.id,item.title,seller.email,seller.stripe_account_id,cents,round(cents::numeric / 10))
    returning * into purchase;
  update public.listings set status='reserved',reservation_order_id=p_order_id,updated_at=now() where id=item.id;
  return to_jsonb(purchase);
end;
$$;

create or replace function public.attach_marketplace_checkout(p_order_id uuid, p_session_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare purchase public.marketplace_orders%rowtype;
begin
  select * into purchase from public.marketplace_orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if purchase.stripe_checkout_session_id is not null and purchase.stripe_checkout_session_id <> p_session_id
    then raise exception 'Checkout session does not match'; end if;
  if p_session_id not like 'cs_test_%' then raise exception 'Sandbox session required'; end if;
  update public.marketplace_orders set stripe_checkout_session_id=p_session_id where id=p_order_id;
end;
$$;

create or replace function public.release_marketplace_order(p_order_id uuid, p_session_id text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare purchase public.marketplace_orders%rowtype;
begin
  select * into purchase from public.marketplace_orders where id=p_order_id for update;
  if not found then return false; end if;
  if purchase.stripe_checkout_session_id is not null
    and (p_session_id is null or purchase.stripe_checkout_session_id <> p_session_id)
    then raise exception 'Checkout session does not match'; end if;
  if purchase.status <> 'pending' then return false; end if;
  perform 1 from public.listings where id=purchase.listing_id for update;
  update public.marketplace_orders set status='expired' where id=p_order_id;
  update public.listings set status='available',reservation_order_id=null,updated_at=now()
    where id=purchase.listing_id and status='reserved' and reservation_order_id=p_order_id;
  return true;
end;
$$;

create or replace function public.complete_marketplace_order(
  p_order_id uuid, p_session_id text, p_payment_intent_id text, p_account_id text,
  p_amount_cents bigint, p_fee_cents bigint, p_currency text, p_buyer_email text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare purchase public.marketplace_orders%rowtype; item public.listings%rowtype;
begin
  select * into purchase from public.marketplace_orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if p_session_id is null or p_payment_intent_id is null or p_account_id is null
    or p_amount_cents is null or p_fee_cents is null or p_currency is null
    or purchase.stripe_account_id <> p_account_id or purchase.amount_cents <> p_amount_cents
    or purchase.fee_cents <> p_fee_cents or purchase.currency <> p_currency
    or (purchase.stripe_checkout_session_id is not null and purchase.stripe_checkout_session_id <> p_session_id)
    or p_session_id not like 'cs_test_%' or p_payment_intent_id not like 'pi_%'
    then raise exception 'Payment does not match the reserved order'; end if;
  if purchase.status='paid' then
    if purchase.stripe_payment_intent_id <> p_payment_intent_id then raise exception 'Payment does not match'; end if;
    return true;
  end if;
  if purchase.status <> 'pending' then raise exception 'Order is no longer pending'; end if;
  select * into item from public.listings where id=purchase.listing_id for update;
  if item.status <> 'reserved' or item.reservation_order_id is distinct from p_order_id
    then raise exception 'Listing reservation does not match'; end if;
  update public.marketplace_orders set status='paid',stripe_checkout_session_id=p_session_id,
    stripe_payment_intent_id=p_payment_intent_id,buyer_email=p_buyer_email,paid_at=now() where id=p_order_id;
  update public.listings set status='sold',sold_at=now(),reservation_order_id=null,updated_at=now() where id=item.id;
  return true;
end;
$$;

revoke all on function public.reserve_marketplace_order(uuid,uuid) from public,anon,authenticated;
revoke all on function public.attach_marketplace_checkout(uuid,text) from public,anon,authenticated;
revoke all on function public.release_marketplace_order(uuid,text) from public,anon,authenticated;
revoke all on function public.complete_marketplace_order(uuid,text,text,text,bigint,bigint,text,text) from public,anon,authenticated;
grant execute on function public.reserve_marketplace_order(uuid,uuid) to service_role;
grant execute on function public.attach_marketplace_checkout(uuid,text) to service_role;
grant execute on function public.release_marketplace_order(uuid,text) to service_role;
grant execute on function public.complete_marketplace_order(uuid,text,text,text,bigint,bigint,text,text) to service_role;

commit;
