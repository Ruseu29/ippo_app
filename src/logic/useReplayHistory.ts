import { useCallback, useEffect, useRef, useState } from "react";
import type { ReplayRecord, StoredReplay } from "../types";
import { loadLocalReplays, saveLocalReplay } from "./replayStorage";
import { fetchRecentReplays, replayErrorMessage, sendReplay } from "./supabase";

export function useReplayHistory() {
  const [local, setLocal] = useState<StoredReplay[]>([]);
  const [online, setOnline] = useState<ReplayRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [onlineError, setOnlineError] = useState("");
  const [localError, setLocalError] = useState("");
  const [sendError, setSendError] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const initialLoad = useRef<[ReturnType<typeof loadLocalReplays>, Promise<ReplayRecord[]>] | null>(null);
  const uploads = useRef(new Map<string, Promise<void>>());

  const remember = useCallback((item: StoredReplay) => {
    setLocal(current => {
      const items = new Map(current.map(value => [value.record.session_id, value]));
      items.set(item.record.session_id, item);
      return [...items.values()];
    });
  }, []);

  useEffect(() => {
    let active = true;
    initialLoad.current ??= [loadLocalReplays(), fetchRecentReplays()];
    const [saved, remote] = initialLoad.current;
    saved.then(({ replays: records, skippedCount }) => {
      if (!active) return;
      if (skippedCount) setLocalError(`${skippedCount}件の旧形式の履歴は移行できませんでした。端末に残し、自動再送から除外しています。`);
      // オンライン通信を待たず、端末履歴と未送信分を先に利用可能にする。
      setLocal(current => {
        const items = new Map(records.map(item => [item.record.session_id, item]));
        for (const item of current) items.set(item.record.session_id, item);
        return [...items.values()];
      });
    }).catch(() => {
      if (active) setLocalError("端末の保存済み履歴を読み込めませんでした。");
    });
    remote.then(records => {
      if (active) setOnline(current => mergeRecords(records, current));
    }).catch(error => {
      if (active) setOnlineError(replayErrorMessage(error));
    });
    Promise.allSettled(initialLoad.current).then(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, []);

  const upload = useCallback((record: ReplayRecord): Promise<void> => {
    const running = uploads.current.get(record.session_id);
    if (running) return running;
    const job = (async () => {
      setIsSyncing(true);
      try {
        await sendReplay(record);
        const saved: StoredReplay = { record, sync_status: "synced" };
        remember(saved);
        setOnline(current => mergeRecords(current, [record]));
        try { await saveLocalReplay(saved); }
        catch { setLocalError("送信は完了しましたが、端末の保存状態を更新できませんでした。"); }
      } finally {
        uploads.current.delete(record.session_id);
        setIsSyncing(uploads.current.size > 0);
      }
    })();
    uploads.current.set(record.session_id, job);
    return job;
  }, [remember]);

  const saveCompleted = useCallback(async (record: ReplayRecord) => {
    const pending: StoredReplay = { record, sync_status: "pending" };
    remember(pending);
    setSendError("");
    try { await saveLocalReplay(pending); }
    catch { setLocalError("端末に保存できませんでした。未送信の場合は、この画面を閉じずに再送してください。"); }
    try { await upload(record); }
    catch (error) { setSendError(replayErrorMessage(error)); }
  }, [remember, upload]);

  const retryPending = useCallback(async () => {
    setSendError("");
    for (const item of local.filter(value => value.sync_status === "pending")) {
      try { await upload(item.record); }
      catch (error) { setSendError(replayErrorMessage(error)); break; }
    }
  }, [local, upload]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetched = await fetchRecentReplays();
      // 取得中に送信を終えた新規プレイも残す。
      setOnline(current => mergeRecords(fetched, current));
      setOnlineError("");
    }
    catch (error) { setOnlineError(replayErrorMessage(error)); }
    finally { setIsLoading(false); }
  }, []);

  return { local, online, isLoading, onlineError, localError, sendError, isSyncing,
    saveCompleted, retryPending, refresh };
}

export function mergeRecords(current: ReplayRecord[], added: ReplayRecord[]): ReplayRecord[] {
  const items = new Map(current.map(record => [record.session_id, record]));
  for (const record of added) items.set(record.session_id, record);
  return [...items.values()].sort((a, b) => Date.parse(b.finished_at) - Date.parse(a.finished_at) || b.session_id.localeCompare(a.session_id));
}
