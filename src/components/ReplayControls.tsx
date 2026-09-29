import { formatReplayTime } from "../logic/replay";

type Props = {
  atMs: number; duration: number; isPlaying: boolean; speed: number;
  markers: { atMs: number; injected: boolean }[];
  onToggle: () => void; onSeek: (value: number) => void; onSpeed: (value: number) => void;
};

export default function ReplayControls({ atMs, duration, isPlaying, speed, markers, onToggle, onSeek, onSpeed }: Props) {
  return <div className="replay-controls">
    <label>再生位置
      <input type="range" min={0} max={Math.ceil(duration)} step={1}
        value={atMs >= duration ? Math.ceil(duration) : Math.floor(atMs)}
        onChange={event => onSeek(Math.min(duration, Number(event.target.value)))} />
    </label>
    <div className="replay-markers">
      {markers.map((mark, index) => <span key={index} className={mark.injected ? "typing-injected" : "typing-error"}
        style={{ left: `${duration > 0 ? mark.atMs / duration * 100 : 0}%` }}
        title={`${mark.injected ? "自動修正" : "誤入力の始まり"}（${formatReplayTime(mark.atMs)}）`} />)}
    </div>
    <small><span className="typing-injected">青：自動修正</span> ／ <span className="typing-error">赤：誤入力の始まり</span></small>
    <div className="actions">
      <button type="button" onClick={onToggle}>{isPlaying ? "一時停止" : "再生"}</button>
      <button type="button" className="secondary" onClick={() => onSeek(0)}>最初に戻す</button>
      <label>再生速度 <select value={speed} onChange={event => onSpeed(Number(event.target.value))}>
        {[0.5, 1, 2, 4].map(value => <option key={value} value={value}>{value}倍</option>)}
      </select></label>
    </div>
  </div>;
}
