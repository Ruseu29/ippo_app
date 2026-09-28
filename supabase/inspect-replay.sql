-- 読み取り専用。Supabase SQL Editorで現在の構成を確認する。
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'play_results'
order by ordinal_position;

select policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' and tablename = 'play_results';

select c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'play_results';

select count(*) as log_rows, count(distinct session_id) as sessions,
       count(*) filter (where session_id is null) as ungrouped_rows
from public.play_results;

select conname, pg_get_constraintdef(oid) as definition from pg_constraint
where conrelid = 'public.play_results'::regclass;

select tgname, pg_get_triggerdef(oid) as definition from pg_trigger
where tgrelid = 'public.play_results'::regclass and not tgisinternal;

select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'play_results'
  and grantee in ('anon', 'authenticated');

select session_id, event_index, count(*) as duplicate_count
from public.play_results where event_index is not null
group by session_id, event_index having count(*) > 1;

select indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename = 'play_results';
