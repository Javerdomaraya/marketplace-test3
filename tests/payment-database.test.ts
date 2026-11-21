import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const listingId = '10000000-0000-4000-8000-000000000001';
const orderId = '20000000-0000-4000-8000-000000000001';
before(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table public.listings (
      id uuid primary key default gen_random_uuid(), title text not null, description text default '',
      price numeric(12,2) not null, category text default 'Other', seller_email text not null,
      image_path text default 'image.jpg', location text, created_at timestamptz default now(), updated_at timestamptz default now()
    );
    alter table public.listings enable row level security;
    grant select, insert on public.listings to anon, authenticated;
    create policy "Browse listings" on public.listings for select to anon, authenticated using(true);
    create policy "Create listings" on public.listings for insert to anon, authenticated with check(true);
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261121000000_stripe_connect.sql', import.meta.url), 'utf8'));
});
beforeEach(async () => {
  await db.exec('reset role; truncate public.marketplace_orders, public.marketplace_sellers, public.listings cascade');
  await db.query(`insert into public.listings(id,title,price,seller_email) values($1,'Test bicycle',70,' SELLER@Example.com ')`, [listingId]);
  await db.query(`insert into public.marketplace_sellers(email,stripe_account_id,app_id,details_submitted,charges_enabled,payouts_enabled)
    values('seller@example.com','acct_testOwn','own-app',true,true,true)`);
});
after(async () => { await db.close(); });
async function reserve(id = orderId) {
  return (await db.query<{ value: { amount_cents: number; fee_cents: number; status: string } }>(
    'select public.reserve_marketplace_order($1,$2) as value', [listingId,id])).rows[0].value;
}
test('database reservation uses stored price and blocks a second buyer', async () => {
  const order = await reserve();
  assert.equal(order.amount_cents, 7000);
  assert.equal(order.fee_cents, 700);
  assert.equal(order.status, 'pending');
  await assert.rejects(() => reserve('20000000-0000-4000-8000-000000000002'), /reserved/i);
});
test('database rejects unready sellers and prices below the card minimum', async () => {
  await db.exec('update public.marketplace_sellers set payouts_enabled=false');
  await assert.rejects(() => reserve(), /seller/i);
  await db.exec('update public.marketplace_sellers set payouts_enabled=true; update public.listings set price=0.49');
  await assert.rejects(() => reserve(), /price/i);
  await db.exec('update public.listings set price=1000000');
  await assert.rejects(() => reserve(), /price/i);
});
test('payment fulfillment is atomic and idempotent, and expiration cannot unsell an item', async () => {
  await reserve();
  await db.query('select public.attach_marketplace_checkout($1,$2)', [orderId,'cs_test_own']);
  const complete = () => db.query('select public.complete_marketplace_order($1,$2,$3,$4,$5,$6,$7,$8)',
    [orderId,'cs_test_own','pi_own','acct_testOwn',7000,700,'usd','buyer@example.com']);
  await complete();
  await complete();
  assert.equal((await db.query<{status:string}>('select status from public.listings')).rows[0].status, 'sold');
  assert.equal((await db.query<{status:string}>('select status from public.marketplace_orders')).rows[0].status, 'paid');
  assert.equal((await db.query<{count:number}>('select count(*)::integer as count from public.marketplace_orders')).rows[0].count, 1);
  await db.query('select public.release_marketplace_order($1,$2)', [orderId,'cs_test_own']);
  assert.equal((await db.query<{status:string}>('select status from public.listings')).rows[0].status, 'sold');
});
test('payment mismatch cannot mark an order paid and cancellation releases only its reservation', async () => {
  await reserve();
  await db.query('select public.attach_marketplace_checkout($1,$2)', [orderId,'cs_test_own']);
  await assert.rejects(() => db.query('select public.complete_marketplace_order($1,$2,$3,$4,$5,$6,$7,$8)',
    [orderId,'cs_test_wrong','pi_own','acct_testOwn',1,700,'usd',null]), /match/i);
  assert.equal((await db.query<{status:string}>('select status from public.listings')).rows[0].status, 'reserved');
  await assert.rejects(() => db.query('select public.release_marketplace_order($1,$2)', [orderId,'cs_test_wrong']), /match/i);
  await db.query('select public.release_marketplace_order($1,$2)', [orderId,'cs_test_own']);
  assert.equal((await db.query<{status:string}>('select status from public.listings')).rows[0].status, 'available');
});
test('visitors cannot access private payment tables, call settlement RPCs, or forge sold listings', async () => {
  await db.exec('set role anon');
  try {
    await assert.rejects(() => db.query('select * from public.marketplace_orders'), /permission denied/i);
    await assert.rejects(() => db.query('select * from public.marketplace_sellers'), /permission denied/i);
    await assert.rejects(() => reserve(), /permission denied/i);
    await assert.rejects(() => db.query(`insert into public.listings(title,price,seller_email,status) values('Fake',1,'a@example.com','sold')`), /row-level security/i);
    await assert.rejects(() => db.query('select reservation_order_id from public.listings'), /permission denied/i);
  } finally { await db.exec('reset role'); }
});

test('settlement requires non-null payment identifiers and amounts', async () => {
  await reserve();
  await assert.rejects(() => db.query('select public.complete_marketplace_order($1,$2,$3,$4,$5,$6,$7,$8)',
    [orderId,null,null,null,null,null,null,null]));
  assert.equal((await db.query<{status:string}>('select status from public.listings')).rows[0].status, 'reserved');
});

test('payment protection preserves anonymous listing creation and display reads', async () => {
  await db.exec('set role anon');
  try {
    const created=await db.query<{id:string}>(`insert into public.listings(title,price,seller_email)
      values('Another item',25,'another@example.com') returning id`);
    assert.equal(created.rows.length,1);
    const display=await db.query<{status:string}>('select id,title,image_path,status from public.listings');
    assert.equal(display.rows.length,2);
    assert.ok(display.rows.every(row=>row.status==='available'));
  } finally { await db.exec('reset role'); }
});
test('checkout recovery parameters are immutable and private',async()=>{
  await reserve();const spec={proof:'a'.repeat(64),createdAt:2000000000,expiresAt:2000002100,appId:'own-app',successUrl:'https://own.example/success',cancelUrl:'https://own.example/cancel'};
  await db.query('select public.save_marketplace_checkout_spec($1,$2)',[orderId,JSON.stringify(spec)]);
  await db.query('select public.save_marketplace_checkout_spec($1,$2)',[orderId,JSON.stringify(spec)]);
  await assert.rejects(()=>db.query('select public.save_marketplace_checkout_spec($1,$2)',[orderId,JSON.stringify({...spec,proof:'b'.repeat(64)})]),/match|immutable/i);
  await db.exec('set role anon');
  try {await assert.rejects(()=>db.query('select public.save_marketplace_checkout_spec($1,$2)',[orderId,JSON.stringify(spec)]),/permission denied/i);}
  finally {await db.exec('reset role');}
});
