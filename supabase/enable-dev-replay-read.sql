-- 開発中の全体履歴を公開鍵で読めるようにする。実行はユーザー側。
-- 画面で同名ポリシーを作成済みでも再適用できる。
-- 10件制限は画面の表示仕様。この条件に合う行は API からも読める。
begin;
grant select on public.play_results to anon;
drop policy if exists "Allow web test replay reads" on public.play_results;
create policy "Allow web test replay reads" on public.play_results
  for select to anon
  using (permission = 'web_test' and prompt_id is not null);
commit;
