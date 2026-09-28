import type { ReplayRecord } from "../types";
import { getReplayPrompt, RECENT_REPLAY_LIMIT } from "../logic/replay";
import { mergeRecords, type useReplayHistory } from "../logic/useReplayHistory";

type Props = {
  history: ReturnType<typeof useReplayHistory>;
  onOpen: (record: ReplayRecord) => void;
  onBack: () => void;
  scope: "online" | "local";
  onScope: (scope: "online" | "local") => void;
};

export default function ReplayHistory({ history, onOpen, onBack, scope, onScope }: Props) {
  const records = mergeRecords([], scope === "online" ? history.online : history.local.map(item => item.record));
  const pending = new Set(history.local.filter(item => item.sync_status === "pending").map(item => item.record.session_id));
  return <section aria-label="リプレイ履歴">
    <h2>直近10プレイ</h2>
    <div className="actions" role="group" aria-label="履歴の保存先">
      <button type="button" aria-pressed={scope === "online"} className={scope === "online" ? "" : "secondary"}
        onClick={() => onScope("online")}>オンライン全体</button>
      <button type="button" aria-pressed={scope === "local"} className={scope === "local" ? "" : "secondary"}
        onClick={() => onScope("local")}>この端末</button>
    </div>
    <p className="history-meta">{scope === "online" ? "ユーザーで絞らず、保存されたプレイを表示します。" : "このブラウザで完了したプレイです。"}</p>
    {history.isLoading && <p role="status">履歴を読み込んでいます。</p>}
    {scope === "online" && history.onlineError && <p role="alert">オンライン履歴を取得できませんでした。{history.onlineError}</p>}
    {!history.isLoading && records.length === 0 && !(scope === "online" && history.onlineError) &&
      <p>表示できる履歴がありません。</p>}
    <ol className="replay-list">{records.slice(0, RECENT_REPLAY_LIMIT).map(record => <li key={record.session_id}>
      <button type="button" className="secondary replay-item" onClick={() => onOpen(record)}>
        <strong>{getReplayPrompt(record)?.title ?? `現在はない文章：${record.prompt_id}`}</strong>
        <span>{new Date(record.finished_at).toLocaleString("ja-JP")} · {record.logs.length}操作
          {scope === "local" && pending.has(record.session_id) ? " · 未送信" : ""}</span>
      </button>
    </li>)}</ol>
    <div className="actions">
      <button type="button" className="secondary" onClick={onBack}>タイトルに戻る</button>
      {scope === "online" && <button type="button" className="secondary" disabled={history.isLoading || history.isSyncing}
        onClick={() => void history.refresh()}>オンライン履歴を更新</button>}
    </div>
  </section>;
}
