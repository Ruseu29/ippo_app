import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import prompts from "../data/prompts";
import type { InputLog, ReplayRecord } from "../types";
import { createReplayRecord, RECENT_REPLAY_LIMIT } from "./replay";
import { isSupportedLogVersion } from "./logger";

// 公開してよい接続情報だけを置く。アクセス制限は Supabase 側の RLS で設定する。
export const supabaseConfig = {
  url: import.meta.env?.VITE_SUPABASE_URL || "https://tujbcuhqgujetaiidkse.supabase.co",
  publishableKey: import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_gUKu1JDetx_bkZ_015c7JA_Qt8w1q5X",
  tableName: "play_results",
};

// クライアントを差し替えられるため、テストで実 DB に触れずに検証できる。
export function createReplayApi(client: SupabaseClient, promptIds: string[]) {
  const table = () => client.from(supabaseConfig.tableName);
  return {
    async sendReplay(record: ReplayRecord): Promise<void> {
      createReplayRecord(record.logs);
      if (record.logs.some(log => !isSupportedLogVersion(log.version))) throw new Error("未対応のログ形式は送信できません。");
      // version は生成時の値を送る。旧ログの再送時にDB既定値で版が変わるのを防ぐ。
      // id / created_at はDBの既定値を使う。
      const rows = record.logs.map(log => ({
        version: log.version,
        session_id: log.session_id, prompt_id: log.prompt_id, event_index: log.event_index,
        sentence_number: log.sentence_number, user_id: log.user_id, device_id: log.device_id,
        permission: log.permission, event_key: log.event_key, timestamp: log.timestamp,
        perf: log.perf, delta_ms: log.delta_ms, is_injected: log.is_injected === true,
      }));
      const { error } = await table().upsert(rows, {
        onConflict: "session_id,event_index", ignoreDuplicates: true, defaultToNull: false,
      }).abortSignal(AbortSignal.timeout(15000));
      if (error) throw error;
    },

    async fetchRecentReplays(): Promise<ReplayRecord[]> {
      if (!promptIds.length) return [];
      const signal = AbortSignal.timeout(15000);
      const { data: finishes, error } = await table().select("session_id,event_index")
        .eq("permission", "web_test").eq("event_key", "Finish").in("prompt_id", promptIds)
        .order("timestamp", { ascending: false }).order("id", { ascending: false })
        .limit(RECENT_REPLAY_LIMIT).abortSignal(signal);
      if (error) throw error;
      if (!finishes?.length) return [];
      const ids = [...new Set(finishes.map(row => row.session_id as string))];
      const logs: InputLog[] = [];
      // 10プレイの全打鍵を取得する。API の1回の返却上限を超えても欠けないように読む。
      let total = Infinity;
      while (logs.length < total) {
        const { data, count, error: pageError } = await table().select(
          "version,session_id,prompt_id,event_index,sentence_number,user_id,device_id,permission,event_key,timestamp,perf,delta_ms,is_injected",
          { count: "exact" },
        ).in("session_id", ids).order("session_id").order("event_index")
          .range(logs.length, logs.length + 999).abortSignal(signal);
        if (pageError) throw pageError;
        if (count === null || !data?.length) throw new Error("オンライン履歴の全ログを取得できませんでした。");
        total = count;
        logs.push(...data as InputLog[]);
      }
      const groups = new Map(ids.map(id => [id, [] as InputLog[]]));
      for (const log of logs) groups.get(log.session_id!)?.push(log);
      return ids.map(id => {
        const record = createReplayRecord(groups.get(id)!);
        const finish = finishes.find(row => row.session_id === id)!;
        if (record.logs.at(-1)!.event_index !== finish.event_index) throw new Error("終了までのログが揃っていません。");
        return record;
      });
    },
  };
}

export const { sendReplay, fetchRecentReplays } = createReplayApi(
  createClient(supabaseConfig.url, supabaseConfig.publishableKey), prompts.map(prompt => prompt.id),
);

export function replayErrorMessage(error: unknown): string {
  const details = error && typeof error === "object" ? error as { code?: string; message?: string } : {};
  if (details.code === "42703" || details.code === "PGRST204") return "Supabaseのログ表に必要な列がまだありません。";
  if (details.code === "42P10") return "Supabaseの再送用の一意索引がまだありません。";
  if (details.code === "42501") return "Supabaseのログ利用権限が設定されていません。";
  return details.message || "通信できませんでした。接続を確認して再試行してください。";
}
