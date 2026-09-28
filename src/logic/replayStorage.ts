import type { InputLog, StoredReplay } from "../types";
import { createReplayRecord, isReplayRecord, logSequenceError, RECENT_REPLAY_LIMIT } from "./replay";

const STORE = "plays";
let connection: Promise<IDBDatabase> | null = null;

// 旧案の端末データは、保存済みの明示的なIDだけで移行する。
// 判別できないものは削除せず、そのまま残して自動再送から外す。
export function normalizeStoredReplay(value: unknown): StoredReplay | null {
  if (!value || typeof value !== "object") return null;
  const item = value as { sync_status: string; record?: {
    schema_version?: number; prompt?: { prompt_id?: string }; logs?: InputLog[];
  } };
  if (item.sync_status !== "pending" && item.sync_status !== "synced") return null;
  if (isReplayRecord(item.record) && !logSequenceError(item.record)) {
    return { record: item.record, sync_status: item.sync_status };
  }
  const old = item.record;
  if (old?.schema_version !== 1 || !old.prompt?.prompt_id || !Array.isArray(old.logs) ||
    old.logs.some(log => !log || log.version !== "1.1" ||
      (log.prompt_id !== undefined && log.prompt_id !== old.prompt!.prompt_id))) return null;
  try {
    return { sync_status: item.sync_status, record: createReplayRecord(
      old.logs.map(log => ({ ...log, prompt_id: old.prompt!.prompt_id })),
    ) };
  } catch { return null; }
}

function openDatabase(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("ippo-replays", 2);
    let blocked = false;
    request.onupgradeneeded = event => {
      if (event.oldVersion === 0) {
        const store = request.result.createObjectStore(STORE, { keyPath: "record.session_id" });
        store.createIndex("finished_at", "record.finished_at");
        store.createIndex("sync_status", "sync_status");
      } else {
        const cursorRequest = request.transaction!.objectStore(STORE).openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const migrated = normalizeStoredReplay(cursor.value);
          if (migrated) cursor.update(migrated);
          cursor.continue();
        };
      }
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error("別のタブが保存先を使用しています。")); };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      db.onversionchange = () => { db.close(); connection = null; };
      resolve(db);
    };
  }).catch((error: unknown) => { connection = null; throw error; });
  return connection;
}

// 直近10件に加え、古くても未送信のデータは再送できるように読む。
export async function loadLocalReplays(): Promise<{ replays: StoredReplay[]; skippedCount: number }> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const found = new Map<string, StoredReplay>();
    const skipped = new Set<IDBValidKey>();
    const keep = (value: unknown, key: IDBValidKey) => {
      const item = normalizeStoredReplay(value);
      if (item) {
        found.set(item.record.session_id, item);
        return true;
      }
      skipped.add(key);
      return false;
    };
    let count = 0;
    const recent = store.index("finished_at").openCursor(null, "prev");
    recent.onsuccess = () => {
      const cursor = recent.result;
      if (!cursor) return;
      if (keep(cursor.value, cursor.primaryKey)) count += 1;
      if (count < RECENT_REPLAY_LIMIT) cursor.continue();
    };
    const pending = store.index("sync_status").openCursor(IDBKeyRange.only("pending"));
    pending.onsuccess = () => {
      const cursor = pending.result;
      if (!cursor) return;
      keep(cursor.value, cursor.primaryKey);
      cursor.continue();
    };
    tx.oncomplete = () => resolve({ replays: [...found.values()], skippedCount: skipped.size });
    tx.onabort = () => reject(tx.error ?? new Error("履歴を読み込めませんでした。"));
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveLocalReplay(item: StoredReplay): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("履歴を保存できませんでした。"));
    tx.onerror = () => reject(tx.error);
  });
}
