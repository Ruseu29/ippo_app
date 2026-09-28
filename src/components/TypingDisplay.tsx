import { useMemo, useState } from "react";
import { convertTypingInput, findTypingError, getExampleRomaji } from "../logic/typing";
import { injectedKanaFlags } from "../logic/typingState";

type Props = {
  prompt: { title: string; text: string; reading: string };
  rawInput: string;
  injectedRaw?: boolean[];
  sentenceNumber: number;
  totalSentences: number;
};

// 通常プレイと再生で表示・誤字判定を共有する。
export default function TypingDisplay({ prompt, rawInput, injectedRaw = [], sentenceNumber, totalSentences }: Props) {
  const [showReading, setShowReading] = useState(false);
  const { convertedText, rawIndex, kanaIndex } = useMemo(() => ({
    convertedText: convertTypingInput(rawInput), ...findTypingError(rawInput, prompt.reading),
  }), [rawInput, prompt.reading]);
  const exampleRomaji = useMemo(() => getExampleRomaji(prompt.reading), [prompt.reading]);
  const kanaStart = Math.max(0, convertedText.length - 12);
  const rawStart = Math.max(0, rawInput.length - 12);
  const kanaInjected = useMemo(() => injectedKanaFlags({ rawInput, injectedRaw }), [rawInput, injectedRaw]);
  const coloredText = (text: string, start: number, errorAt: number, injected: boolean[]) =>
    Array.from(text.slice(start), (character, offset) => {
      const index = start + offset;
      return <span key={index} className={injected[index] ? "typing-injected" : index >= errorAt ? "typing-error" : undefined}
        title={injected[index] ? "自動修正による入力" : undefined}>{character}</span>;
    });
  return <>
    <p className="description">{sentenceNumber}/{totalSentences}</p>
    <span className="label">{prompt.title}</span>
    <p className="prompt">{prompt.text}</p>
    <button type="button" aria-expanded={showReading} onClick={() => setShowReading(open => !open)}>
      {showReading ? "読みを閉じる" : "読みを見る"}
    </button>
    {showReading && <>
      <p className="description">{prompt.reading}</p>
      <span className="label">模範のローマ字</span>
      <p className="description">{exampleRomaji}</p>
    </>}
    <span className="label">WanaKanaの変換結果</span>
    <p className="prompt">{convertedText ? <>
      {kanaStart > 0 && "…"}{coloredText(convertedText, kanaStart, kanaIndex, kanaInjected)}
    </> : "（まだ入力されていません）"}</p>
    <span className="label">現在の生入力（ローマ字）</span>
    <p className="description">{rawInput ? <>
      {rawStart > 0 && "…"}{coloredText(rawInput, rawStart, rawIndex, injectedRaw)}
    </> : "（まだ入力されていません）"}</p>
    <p className="description">{convertedText === prompt.reading ? "出題文の読みに一致しました。" : "入力中です。"}</p>
  </>;
}
