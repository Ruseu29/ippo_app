import type { InputLog } from "../types";

type ResultViewProps = {
  totalQuestions: number;
  inputLogs: InputLog[];
  onReset: () => void;
};

export default function ResultView({
  totalQuestions,
  inputLogs,
  onReset,
}: ResultViewProps) {
  const backspaceCount = inputLogs.filter(
    (log) => log.event_key === "Backspace",
  ).length;

  const intervals = inputLogs
    .map((log) => log.delta_ms)
    .filter((delta): delta is number => delta !== null)
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

      <p className="description">打った回数：{inputLogs.length}回</p>
      <p className="description">Backspace：{backspaceCount}回</p>
      <p className="description">平均スピード：{averageSpeed.toFixed(2)}打鍵/秒</p>
      <p className="description">入力間隔の中央値：{medianInterval.toFixed(1)}ms</p>

      <div className="actions">
        <button type="button" onClick={onReset}>
          タイトルに戻る
        </button>
      </div>
    </>
  );
}
