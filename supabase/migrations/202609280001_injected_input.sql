-- 自動修正による入力を区別する。旧行は false として読む。
begin;
alter table public.play_results
  add column if not exists is_injected boolean not null default false;
comment on column public.play_results.is_injected is
  'true: 自動修正で追加したキー操作。false: 通常の入力・進行操作。';
commit;
