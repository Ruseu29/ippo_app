import { useEffect, useState } from "react";
import { toRomaji } from "wanakana";
import {
  convertTypingInput,
  deleteLastCharacter,
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
  isSending,
  onNext,
  onResult,
  onReset,
  onKeyLog,
}: TypingAreaProps) {
  // 実際に押されたアルファベットを保存する。
  const [rawInput, setRawInput] = useState("");

  // rawInputが変わるたびに、画面へ出す文字を作る。
  const convertedText = convertTypingInput(rawInput);
  const exampleRomaji = toRomaji(prompt.reading);

  const isLastQuestion = questionNumber === totalQuestions;
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

      if (/^[a-zA-Z]$/.test(event.key)) {
        setRawInput((current) => current + event.key.toLowerCase());
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSending, isComplete, isLastQuestion, onKeyLog, onNext, onReset, onResult]);

  return (
    <>
      <p className="description">
        問題 {questionNumber} / {totalQuestions}
      </p>
      <span className="label">{prompt.title}</span>
      <p className="prompt">{prompt.text}</p>
      <p className="description">{prompt.reading}</p>

      <span className="label">模範のローマ字</span>
      <p className="description">{exampleRomaji}</p>

      <span className="label">WanaKanaの変換結果</span>
      <p className="prompt">{convertedText || "（まだ入力されていません）"}</p>

      <span className="label">現在の生入力（ローマ字）</span>
      <p className="description">{rawInput || "（まだ入力されていません）"}</p>

      <p className="description">
        {isComplete ? "出題文の読みに一致しました。" : "入力中です。"}
      </p>

      <div className="actions">
        <button
          type="button"
          onClick={isLastQuestion ? onResult : onNext}
          disabled={!isComplete || isSending}
        >
          {isLastQuestion ? "判定する" : "次の問題"}
        </button>
      </div>
    </>
  );
}
