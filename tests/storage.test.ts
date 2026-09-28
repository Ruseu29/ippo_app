import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadLocalReplays, saveLocalReplay } from "../src/logic/replayStorage";
import { samplePlay, samplePrompt } from "./fixtures";

const open = (version: number) => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open("ippo-replays", version);
  request.onupgradeneeded = () => {
    const store = request.result.createObjectStore("plays", { keyPath: "record.session_id" });
    store.createIndex("finished_at", "record.finished_at");
    store.createIndex("sync_status", "sync_status");
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const all = (db: IDBDatabase) => new Promise<any[]>(resolve => {
  const request = db.transaction("plays").objectStore("plays").getAll();
  request.onsuccess = () => resolve(request.result);
});

test("旧端末データをIDで移行、不明な旧形式は保持。最新10件と古い未送信を復元", async () => {
  const oldDb = await open(1);
  const old = { ...samplePlay(1), schema_version: 1,
    prompt: { prompt_id: samplePrompt.id, title: "旧文章", segments: samplePrompt.segments },
    logs: samplePlay(1).logs.map(({ prompt_id, is_injected, ...log }) => ({ ...log, version: "1.1" })),
  };
  const unconvertible = { ...old, session_id: samplePlay(99).session_id, prompt: null };
  await new Promise<void>((resolve, reject) => {
    const tx = oldDb.transaction("plays", "readwrite");
    tx.objectStore("plays").put({ record: old, sync_status: "pending" });
    tx.objectStore("plays").put({ record: unconvertible, sync_status: "pending" });
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  oldDb.close();
  let loaded = await loadLocalReplays();
  assert.equal(loaded.replays.length, 1);
  assert.equal(loaded.skippedCount, 1);
  assert.equal(loaded.replays[0].record.schema_version, 2);
  assert.equal("prompt" in loaded.replays[0].record, false);
  assert.equal(loaded.replays[0].record.logs[0].prompt_id, samplePrompt.id);

  for (let n = 2; n <= 12; n++) await saveLocalReplay({ record: samplePlay(n), sync_status: "synced" });
  loaded = await loadLocalReplays();
  assert.equal(loaded.replays.length, 11);
  assert.ok(loaded.replays.some(item => item.record.session_id === samplePlay(1).session_id));
  assert.ok(!loaded.replays.some(item => item.record.session_id === samplePlay(2).session_id));
  await saveLocalReplay({ record: loaded.replays.find(item => item.record.session_id === samplePlay(1).session_id)!.record, sync_status: "synced" });
  loaded = await loadLocalReplays();
  assert.equal(loaded.replays.length, 10);
  const database = await open(2);
  const persisted = await all(database);
  assert.equal(persisted.length, 13);
  assert.deepEqual(persisted.find(item => item.record.session_id === unconvertible.session_id).record, unconvertible);
  database.close();
});

test("端末保存・再読込でも注入フラグを保持する", async () => {
  const record = samplePlay(40);
  record.logs[0].is_injected = true;
  record.logs[0].delta_ms = null;
  await saveLocalReplay({ record, sync_status: "pending" });
  const loaded = await loadLocalReplays();
  assert.deepEqual(loaded.replays.find(item => item.record.session_id === record.session_id)?.record, record);
});
