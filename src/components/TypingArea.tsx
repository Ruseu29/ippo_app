import { useEffect } from "react";
import TypingDisplay from "./TypingDisplay";
import type { CorrectionMatch } from "../logic/autocorrect";
import { convertTypingInput } from "../logic/typing";
import { useTypingInput } from "../logic/useTypingInput";

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
  isCompleted: boolean;
  autocorrectEnabled: boolean;
  onNext: () => void;
  onResult: () => void;
  onReset: () => void;
  onKeyLog: (key: string, isInjected?: boolean) => void;
  onCorrectionMatch: (match: CorrectionMatch) => void;
};

export default function TypingArea({
  prompt,
  questionNumber,
  totalQuestions,
  sentenceNumber,
  totalSentences,
  isSending,
  isCompleted,
  autocorrectEnabled,
  onNext,
  onResult,
  onReset,
  onKeyLog,
  onCorrectionMatch,
}: TypingAreaProps) {
  const { rawInput, injectedRaw, inputKey, correctionError } = useTypingInput({
    autocorrectEnabled, onKeyLog, onCorrectionMatch,
  });
  const convertedText = convertTypingInput(rawInput);

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

      // 終了確定後は、送信の再試行とタイトルに戻る操作だけ許可する。
      if (isCompleted) {
        if (event.key === "Backspace") event.preventDefault();
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        inputKey("Backspace");
        return;
      }

      if (/^[a-zA-Z,.'-]$/.test(event.key)) {
        event.preventDefault();
        inputKey(event.key);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSending, isCompleted, isComplete, isLastQuestion, inputKey, onKeyLog, onNext, onReset, onResult]);

  return (
    <>
      <TypingDisplay prompt={prompt} rawInput={rawInput} injectedRaw={injectedRaw}
        sentenceNumber={sentenceNumber} totalSentences={totalSentences} />
      {correctionError && <p role="alert">{correctionError}</p>}

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
