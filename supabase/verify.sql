-- Run AFTER schema.sql in the Supabase SQL Editor.
-- These queries check configuration; they do NOT write sample records.

select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('listings','messages')
order by table_name;

select tablename, policyname, cmd, roles from pg_policies
where schemaname = 'public' and tablename in ('listings','messages')
order by tablename, policyname;

select
  has_column_privilege('anon', 'public.listings', 'id', 'SELECT')
    and has_column_privilege('anon', 'public.listings', 'title', 'SELECT')
    and has_column_privilege('anon', 'public.listings', 'image_path', 'SELECT') as can_browse_listings,
  has_table_privilege('anon', 'public.listings', 'INSERT') as can_create_listings,
  has_table_privilege('anon', 'public.messages', 'INSERT') as can_send_message,
  has_table_privilege('anon', 'public.messages', 'SELECT') as can_read_messages_should_be_false;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'listing-images';

select column_name, data_type, is_nullable from information_schema.columns
where table_schema = 'public' and table_name = 'listings'
  and column_name in ('category','location');

select policyname, cmd, roles from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname = 'Upload marketplace images';
