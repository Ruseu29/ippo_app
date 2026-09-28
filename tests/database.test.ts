import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createReplayApi } from "../src/logic/supabase";
import { createReplayRecord, isReplayRecord } from "../src/logic/replay";
import { samplePlay, samplePrompt } from "./fixtures";
import { createMockRest, createTestDatabase, migrationSql, readPolicySql, injectedMigrationSql, versionMigrationSql } from "./mockSupabase";

let db: Awaited<ReturnType<typeof createTestDatabase>>;
let rest: ReturnType<typeof createMockRest>;
let api: ReturnType<typeof createReplayApi>;
before(async () => {
  db = await createTestDatabase();
  rest = createMockRest(db);
  api = createReplayApi(createClient("http://test.invalid", "test-key", { global: { fetch: rest.fetch } }), [samplePrompt.id]);
});
after(() => db.close());
const count = async () => (await db.query<{ count: number }>("select count(*)::int as count from play_results")).rows[0].count;

test("生成時のversionを明示送信し、同じ再送を重複・更新しない", async () => {
  await db.exec(await migrationSql());
  await db.exec(await readPolicySql());
  const record = samplePlay();
  await api.sendReplay(record);
  await api.sendReplay(record);
  assert.equal(await count(), 6);
  assert.ok(rest.stats.lastWrite.every(row => row.version === "1.2" && !("id" in row) && !("created_at" in row)));
  const changed = structuredClone(record);
  changed.logs[0].event_key = "z";
  await api.sendReplay(changed);
  assert.equal(await count(), 6);
  const fetched = await api.fetchRecentReplays();
  assert.equal(fetched[0].logs[0].event_key, "k");
  assert.ok(fetched[0].logs.every(log => log.version === "1.2"));
  assert.deepEqual(fetched[0], record);
});

test("一括保存途中の制約違反は全件取り消す。壊れた操作順も送信しない", async () => {
  const broken = samplePlay(2);
  broken.logs[1].event_index = 90;
  const writes = rest.stats.writes;
  await assert.rejects(api.sendReplay(broken), /順序/);
  assert.equal(rest.stats.writes, writes);
  await db.exec("alter table play_results add constraint test_reject check (event_key <> 'Forbidden')");
  await assert.rejects(api.sendReplay(samplePlay(3, ["a", "Forbidden", "NextSentence", "Finish"])), { code: "23514", message: /test_reject/ });
  assert.equal(await count(), 6);
  await db.exec("alter table play_results drop constraint test_reject");
});

test("SELECTポリシー前は読めず、許可後も対象外の旧行は見えない", async () => {
  await db.exec('drop policy "Allow web test replay reads" on play_results');
  assert.deepEqual(await api.fetchRecentReplays(), []);
  await db.exec(await readPolicySql());
  // event_index NULL の旧行は同じセッションでも複数保存できる。
  await db.exec(`insert into play_results (session_id,permission,event_key,timestamp,perf)
    values ('00000000-0000-4000-8000-000000000099','web_test','a',now(),10),
           ('00000000-0000-4000-8000-000000000099','web_test','b',now(),20)`);
  const visible = await db.transaction(async tx => {
    await tx.exec("set local role anon");
    return tx.query("select * from play_results");
  });
  assert.equal(visible.rows.length, 6);
  await assert.rejects(db.transaction(async tx => {
    await tx.exec("set local role anon");
    await tx.query("delete from play_results");
  }), /permission denied/);
  assert.equal((await db.query("select tablename from pg_tables where schemaname='public'")).rows.length, 1);
});

test("現在ある文章の直近10プレイ。1000打鍵超を全取得し、古いデータは残す", async () => {
  for (let n = 2; n <= 12; n++) await api.sendReplay(samplePlay(n));
  await api.sendReplay(samplePlay(13, [...Array(1100).fill("a"), "NextSentence", "Finish"]));
  await api.sendReplay(createReplayRecord(samplePlay(14).logs.map(log => ({ ...log, prompt_id: "removed-prompt" }))));
  const records = await api.fetchRecentReplays();
  assert.equal(records.length, 10);
  assert.equal(records[0].logs.length, 1102);
  assert.equal(records.at(-1)!.session_id, samplePlay(4).session_id);
  assert.ok(records.every(isReplayRecord));
  assert.equal(await count(), 12 * 6 + 1102 + 6 + 2);
  // API の上限が要求した range より小さくても、取得済み件数から続きを読む。
  const capped = createMockRest(db, 2);
  const cappedApi = createReplayApi(createClient("http://test.invalid", "test-key", { global: { fetch: capped.fetch } }), ["removed-prompt"]);
  assert.equal((await cappedApi.fetchRecentReplays())[0].logs.length, 6);
  assert.equal(capped.stats.reads, 4);
});

test("ログ欠損を短い正常リプレイとして扱わない", async () => {
  await db.query("delete from play_results where session_id=$1 and event_index=1", [samplePlay(13).session_id]);
  await assert.rejects(api.fetchRecentReplays(), /順序/);
});

test("注入列を再適用でき、通常ログ・注入ログを保存と再取得で区別する", async () => {
  await db.exec(await injectedMigrationSql());
  const record = samplePlay(30, ["d", "e", "u", "s", "Backspace", "Backspace", "s", "u", "NextSentence", "Finish"]);
  record.prompt_id = "injected-test";
  record.logs = record.logs.map((log, index) => ({ ...log, prompt_id: record.prompt_id,
    is_injected: index >= 4 && index < 8, delta_ms: index >= 4 && index < 8 ? null : log.delta_ms,
  }));
  const injectedApi = createReplayApi(createClient("http://test.invalid", "test-key", { global: { fetch: rest.fetch } }), [record.prompt_id]);
  await injectedApi.sendReplay(record);
  await injectedApi.sendReplay(record);
  assert.deepEqual(await injectedApi.fetchRecentReplays(), [record]);
  const legacy = await db.query<{ is_injected: boolean }>("select is_injected from play_results where event_index is null");
  assert.ok(legacy.rows.length > 0 && legacy.rows.every(row => row.is_injected === false));
});

test("DBの既定値に依存せず1.2を保存し、移行後も旧1.1の再送で版を変えない", async () => {
  const promptId = "version-test";
  const versionApi = createReplayApi(createClient("http://test.invalid", "test-key", { global: { fetch: rest.fetch } }), [promptId]);
  const current = samplePlay(42);
  current.prompt_id = promptId;
  current.logs.forEach(log => { log.prompt_id = promptId; });
  await db.exec("alter table play_results alter column version set default '1.1'");
  await versionApi.sendReplay(current);
  assert.deepEqual(await versionApi.fetchRecentReplays(), [current]);

  const legacy = samplePlay(41);
  legacy.prompt_id = promptId;
  legacy.logs.forEach(log => { log.prompt_id = promptId; log.version = "1.1"; delete log.is_injected; });
  await db.exec(await versionMigrationSql());
  await versionApi.sendReplay(legacy);
  await db.exec(await versionMigrationSql());
  await versionApi.sendReplay(legacy);
  const fetched = await versionApi.fetchRecentReplays();
  assert.equal(fetched.length, 2);
  assert.deepEqual(fetched[0], current);
  assert.ok(fetched[1].logs.every(log => log.version === "1.1" && log.is_injected === false));
  assert.ok(legacy.logs.every(log => log.version === "1.1" && log.is_injected === undefined));
  const defaultValue = await db.query<{ column_default: string }>(
    "select column_default from information_schema.columns where table_schema='public' and table_name='play_results' and column_name='version'",
  );
  assert.equal(defaultValue.rows[0].column_default, "'1.2'::text");
  const writes = rest.stats.writes;
  const unknown = samplePlay(43);
  unknown.logs.forEach(log => { log.version = "9.0"; });
  await assert.rejects(versionApi.sendReplay(unknown), /未対応/);
  assert.equal(rest.stats.writes, writes);
});
