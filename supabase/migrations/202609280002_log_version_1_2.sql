-- 202609280001_injected_input.sql の適用後に実行する。
-- アプリは生成時のversionを明示送信する。省略されたINSERTの既定値も1.2へ揃える。
-- 既存行のversionは更新しない。
begin;
alter table public.play_results alter column version set default '1.2';
commit;
