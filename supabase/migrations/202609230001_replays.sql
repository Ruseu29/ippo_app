-- 既存の play_results にだけ追加する。既存行は変更しない。
-- 先に inspect-replay.sql で重複と権限を確認する。
begin;
alter table public.play_results add column if not exists prompt_id text;

-- 再送しても二重保存しない。NULL の旧ログは共存できる。
-- 重複があれば削除せず失敗する。
create unique index if not exists play_results_session_event_unique
  on public.play_results (session_id, event_index);

create index if not exists play_results_recent_finish
  on public.play_results (timestamp desc, id desc)
  where event_key = 'Finish' and prompt_id is not null;
commit;
