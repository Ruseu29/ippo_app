import { useEffect, useMemo, useRef, useState } from "react";
import type { ReplayRecord } from "../types";
import { buildReplayFrames, formatReplayTime, getReplayFrame, getReplayPrompt, replayUnavailableReason } from "../logic/replay";
import ReplayControls from "./ReplayControls";
import TypingDisplay from "./TypingDisplay";

export default function ReplayView({ record, onBack }: { record: ReplayRecord; onBack: () => void }) {
  const { prompt, reason, frames } = useMemo(() => {
    const prompt = getReplayPrompt(record);
    const reason = replayUnavailableReason(record, prompt);
    return { prompt, reason, frames: reason ? [] : buildReplayFrames(record, prompt) };
  }, [record]);
  const [showLogs, setShowLogs] = useState(false);
  const logText = useMemo(() => showLogs ? JSON.stringify(record.logs, null, 2) : "", [record.logs, showLogs]);
  const duration = frames.at(-1)?.atMs ?? 0;
  const [atMs, setAtMs] = useState(0);
  const position = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!isPlaying) return;
    const from = position.current;
    const started = performance.now();
    let animation = 0;
    const tick = () => {
      const next = Math.min(duration, from + (performance.now() - started) * speed);
      position.current = next;
      setAtMs(next);
      if (next >= duration) setIsPlaying(false);
      else animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [isPlaying, speed, duration]);

  const seek = (value: number) => { setIsPlaying(false); position.current = value; setAtMs(value); };
  const frame = frames.length ? getReplayFrame(frames, atMs) : null;
  return <section aria-label="リプレイ">
    <h2>リプレイ</h2>
    <p className="history-meta">{new Date(record.finished_at).toLocaleString("ja-JP")}</p>
    {reason && <p role="status">{reason}</p>}
    {frame && prompt && <>
      <TypingDisplay
        key={frame.sentenceIndex}
        prompt={{ title: prompt.title, ...prompt.segments[frame.sentenceIndex] }}
        rawInput={frame.rawInput} injectedRaw={frame.injectedRaw} sentenceNumber={frame.sentenceIndex + 1}
        totalSentences={prompt.segments.length}
      />
      <ReplayControls atMs={atMs} duration={duration} isPlaying={isPlaying} speed={speed}
        onSeek={seek} onSpeed={setSpeed} onToggle={() => {
          if (atMs >= duration) { position.current = 0; setAtMs(0); }
          setIsPlaying(playing => !playing);
        }} />
      <p role="status">{frame.isFinished ? "再生が終了しました。" : `${formatReplayTime(atMs)} / ${formatReplayTime(duration)}`}</p>
    </>}
    <details className="replay-log" onToggle={event => { if (event.currentTarget.open) setShowLogs(true); }}>
      <summary>保存されたログを見る（{record.logs.length}件）</summary>
      <p>セッション：{record.session_id}</p>
      <p>文章：{record.prompt_id}（現在の問題文で再生）</p>
      <pre>{logText}</pre>
    </details>
    <div className="actions"><button type="button" className="secondary" onClick={onBack}>履歴に戻る</button></div>
  </section>;
}
