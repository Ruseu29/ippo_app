export type InputLog = {
  version: string;
  session_id: string | null;
  user_id: string | null;
  device_id: string | null;
  permission: "web_test";
  event_key: string;
  // 旧ログの未指定は false として扱う。
  is_injected?: boolean;
  timestamp: string;
  perf: number;
  delta_ms: number | null;
  // 旧ログにはない。時刻が同じでも順序と文章内の位置を特定する。
  event_index?: number;
  sentence_number?: number;
  prompt_id?: string;
};

export type ReplayRecord = {
  // IndexedDB 内の形式。DB のログ version とは別。
  schema_version: 2;
  session_id: string;
  prompt_id: string;
  started_at: string;
  finished_at: string;
  started_perf: number;
  logs: InputLog[];
};

export type StoredReplay = {
  record: ReplayRecord;
  sync_status: "pending" | "synced";
};
