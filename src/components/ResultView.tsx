import { useEffect } from "react";
import { isPlayEvent } from "../logic/logger";
import type { InputLog } from "../types";

type ResultViewProps = {
  totalQuestions: number;
  inputLogs: InputLog[];
  onReset: () => void;
  onRetry: () => void;
};

export default function ResultView({
  totalQuestions,
  inputLogs,
  onReset,
  onRetry,
}: ResultViewProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onReset(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onReset]);

  const keyLogs = inputLogs.filter((log) => !log.is_injected && !isPlayEvent(log.event_key));
  const backspaceCount = keyLogs.filter(
    (log) => log.event_key === "Backspace",
  ).length;

  // 進行イベントを挟んでも、実際のキー同士の間隔で集計する。
  const intervals = keyLogs
    .slice(1)
    .map((log, index) => Math.round((log.perf - keyLogs[index].perf) * 10) / 10)
    .sort((a, b) => a - b);

  const averageInterval = intervals.length
    ? intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
    : 0;
  const middle = Math.floor(intervals.length / 2);
  const medianInterval = intervals.length
    ? intervals.length % 2 === 0
      ? (intervals[middle - 1] + intervals[middle]) / 2
      : intervals[middle]
    : 0;
  const averageSpeed = averageInterval > 0 ? 1000 / averageInterval : 0;

  return (
    <>
      <span className="label">RESULT</span>
      <p className="prompt">全{totalQuestions}問を完了しました。</p>

      <p className="description">打った回数：{keyLogs.length}回</p>
      <p className="description">Backspace：{backspaceCount}回</p>
      <p className="description">平均スピード：{averageSpeed.toFixed(2)}打鍵/秒</p>
      <p className="description">入力間隔の中央値：{medianInterval.toFixed(1)}ms</p>

      <div className="actions">
        <button type="button" onClick={onRetry}>もう1回する</button>
        <button type="button" onClick={onReset}>
          タイトルに戻る
        </button>
      </div>
    </>
  );
}
