import { useEffect, useState } from "react";
import { toRomaji } from "wanakana";
import {
  convertTypingInput,
  deleteLastCharacter,
  findTypingError,
} from "../logic/typing";

type Prompt = {
  title: string;
  text: string;
  reading: string;
};

type TypingAreaProps = {
  prompt: Prompt;
  questionNumber: number;
  totalQuestions: number;
  sentenceNumber: number;
  totalSentences: number;
  isSending: boolean;
  onNext: () => void;
  onResult: () => void;
  onReset: () => void;
  onKeyLog: (key: string) => void;
};

export default function TypingArea({
  prompt,
  questionNumber,
  totalQuestions,
  sentenceNumber,
  totalSentences,
  isSending,
  onNext,
  onResult,
  onReset,
  onKeyLog,
}: TypingAreaProps) {
  // 実際に押されたアルファベットを保存する。
  const [rawInput, setRawInput] = useState("");
  const [showReading, setShowReading] = useState(false);

  // rawInputが変わるたびに、画面へ出す文字を作る。
  const convertedText = convertTypingInput(rawInput);
  // 「んの」「っち」も変換表と合うローマ字で案内する。
  const exampleRomaji = toRomaji(prompt.reading, {
    customRomajiMapping: { ん: "nn", "っち": "tti" },
  });
  const { rawIndex, kanaIndex } = findTypingError(rawInput, prompt.reading);
  // 入力は全文を保持し、画面だけ末尾12文字に絞る。
  const kanaStart = Math.max(0, convertedText.length - 12);
  const rawStart = Math.max(0, rawInput.length - 12);

  const isLastSentence = sentenceNumber === totalSentences;
  const isLastQuestion = questionNumber === totalQuestions && isLastSentence;
  const isComplete = convertedText === prompt.reading;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // 送信中は入力・問題移動・リセットを止める。
      if (isSending) {
        if (["Enter", " ", "Backspace"].includes(event.key)) event.preventDefault();
        return;
      }
      const loggedKey =
        event.key === " "
          ? "Space"
          : /^[a-zA-Z]$/.test(event.key)
            ? event.key.toLowerCase()
            : event.key;
      onKeyLog(loggedKey);

      if (event.key === "Escape") {
        onReset();
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (isComplete) {
          isLastQuestion ? onResult() : onNext();
        }
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        setRawInput((current) => deleteLastCharacter(current));
        return;
      }

      if (/^[a-zA-Z,.'-]$/.test(event.key)) {
        event.preventDefault();
        setRawInput((current) => current + event.key.toLowerCase());
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSending, isComplete, isLastQuestion, onKeyLog, onNext, onReset, onResult]);

  return (
    <>
      <p className="description">
        {sentenceNumber}/{totalSentences}
      </p>
      <span className="label">{prompt.title}</span>
      <p className="prompt">{prompt.text}</p>
      <button
        type="button"
        aria-expanded={showReading}
        onClick={() => setShowReading((open) => !open)}
      >
        {showReading ? "読みを閉じる" : "読みを見る"}
      </button>
      {showReading && (
        <>
          <p className="description">{prompt.reading}</p>
          <span className="label">模範のローマ字</span>
          <p className="description">{exampleRomaji}</p>
        </>
      )}

      <span className="label">WanaKanaの変換結果</span>
      <p className="prompt">
        {convertedText ? <>
          {kanaStart > 0 && "…"}
          {convertedText.slice(kanaStart, kanaIndex)}
          <span className="typing-error">{convertedText.slice(Math.max(kanaStart, kanaIndex))}</span>
        </> : "（まだ入力されていません）"}
      </p>

      <span className="label">現在の生入力（ローマ字）</span>
      <p className="description">
        {rawInput ? <>
          {rawStart > 0 && "…"}
          {rawInput.slice(rawStart, rawIndex)}
          <span className="typing-error">{rawInput.slice(Math.max(rawStart, rawIndex))}</span>
        </> : "（まだ入力されていません）"}
      </p>

      <p className="description">
        {isComplete ? "出題文の読みに一致しました。" : "入力中です。"}
      </p>

      <div className="actions">
        <button
          type="button"
          onClick={isLastQuestion ? onResult : onNext}
          disabled={!isComplete || isSending}
        >
          {isLastQuestion ? "判定する" : isLastSentence ? "次の問題" : "次の文"}
        </button>
      </div>
    </>
  );
}
