import { useState } from "react";
import defaults from "../data/corrections.json";
import type { CorrectionDictionary } from "../logic/autocorrect";
import { formatCorrectionDictionary, parseCorrectionDictionary } from "../logic/correctionDictionary";

type Props = { dictionary: CorrectionDictionary; onApply: (dictionary: CorrectionDictionary) => void };

export default function CorrectionEditor({ dictionary, onApply }: Props) {
  const [draft, setDraft] = useState(() => formatCorrectionDictionary(dictionary));
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const isTemporary = formatCorrectionDictionary(dictionary) !== formatCorrectionDictionary(defaults);
  const isEdited = draft !== formatCorrectionDictionary(dictionary);

  function handleDraft(save: boolean) {
    try {
      const parsed = parseCorrectionDictionary(draft);
      if (!save) { onApply(parsed); setDraft(formatCorrectionDictionary(parsed)); }
      setError("");
      setStatus(save ? "編集中の辞書のJSONダウンロードを開始しました。" : "このタブに辞書を適用しました。自動修正はONです。");
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      setStatus("");
      return false;
    }
  }

  return (
    <details className="correction-editor replay-log">
      <summary>編集</summary>
      <p className="history-meta">変更はこのタブだけに適用されます。再読み込みで標準に戻るため、残したい辞書はJSONで保存してください。</p>
      <p>適用中：{Object.keys(dictionary).length}件（{isTemporary ? "臨時適用中" : "標準"}）{isEdited && " ／ 編集内容はまだ適用されていません。"}</p>
      <textarea aria-label="臨時の修正辞書JSON" rows={12} spellCheck={false} value={draft}
        onChange={event => { setDraft(event.target.value); setError(""); setStatus(""); }} />
      <div className="actions">
        <button type="button" onClick={() => handleDraft(false)}>このタブに適用</button>
        <a className="download-button" download="corrections.json" href={"data:application/json;charset=utf-8," + encodeURIComponent(draft)}
          onClick={event => { if (!handleDraft(true)) event.preventDefault(); }}>JSONを保存</a>
        <button type="button" className="secondary" onClick={() => {
          onApply(defaults); setDraft(formatCorrectionDictionary(defaults)); setError(""); setStatus("標準の辞書に戻しました。");
        }}>標準に戻す</button>
      </div>
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
    </details>
  );
}
