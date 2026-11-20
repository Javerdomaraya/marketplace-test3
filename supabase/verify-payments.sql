-- Read-only Test 4 configuration checks. Run after the Stripe Connect migration.
select table_name from information_schema.tables
where table_schema='public' and table_name in ('marketplace_sellers','marketplace_orders');
select relname,relrowsecurity from pg_class
where oid in ('public.marketplace_sellers'::regclass,'public.marketplace_orders'::regclass);
select
  has_table_privilege('anon','public.marketplace_orders','SELECT') as private_orders_should_be_false,
  has_table_privilege('anon','public.marketplace_sellers','SELECT') as private_sellers_should_be_false,
  has_column_privilege('anon','public.listings','title','SELECT') as public_listing_title_should_be_true,
  has_column_privilege('anon','public.listings','status','SELECT') as public_listing_status_should_be_true,
  has_column_privilege('anon','public.listings','reservation_order_id','SELECT') as private_reservation_should_be_false,
  has_function_privilege('anon','public.reserve_marketplace_order(uuid,uuid)','EXECUTE') as visitor_reserve_should_be_false,
  has_function_privilege('service_role','public.reserve_marketplace_order(uuid,uuid)','EXECUTE') as server_reserve_should_be_true;
select status,count(*) from public.listings group by status;
select status,count(*) from public.marketplace_orders group by status;
