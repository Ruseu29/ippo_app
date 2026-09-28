type Props = {
  atMs: number; duration: number; isPlaying: boolean; speed: number;
  onToggle: () => void; onSeek: (value: number) => void; onSpeed: (value: number) => void;
};

export default function ReplayControls({ atMs, duration, isPlaying, speed, onToggle, onSeek, onSpeed }: Props) {
  return <div className="replay-controls">
    <label>再生位置
      <input type="range" min={0} max={Math.ceil(duration)} step={1}
        value={atMs >= duration ? Math.ceil(duration) : Math.floor(atMs)}
        onChange={event => onSeek(Math.min(duration, Number(event.target.value)))} />
    </label>
    <div className="actions">
      <button type="button" onClick={onToggle}>{isPlaying ? "一時停止" : "再生"}</button>
      <button type="button" className="secondary" onClick={() => onSeek(0)}>最初に戻す</button>
      <label>再生速度 <select value={speed} onChange={event => onSpeed(Number(event.target.value))}>
        {[0.5, 1, 2, 4].map(value => <option key={value} value={value}>{value}倍</option>)}
      </select></label>
    </div>
  </div>;
}
