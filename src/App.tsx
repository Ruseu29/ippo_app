import { useCallback, useRef, useState } from "react";
import ResultView from "./components/ResultView";
import TypingArea from "./components/TypingArea";
import prompts from "./data/prompts.json";
import { createInputLog } from "./logic/logger";
import type { InputLog } from "./types";

export default function App() {
  // Appが覚えておく状態
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [inputLogs, setInputLogs] = useState<InputLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const previousPerf = useRef<number | null>(null);

  const recordKey = useCallback((key: string) => {
    const { log, rawPerf } = createInputLog(key, previousPerf.current);
    previousPerf.current = rawPerf;
    setInputLogs((current) => [...current, log]);
  }, []);

  // 現在表示する問題
  const currentPrompt = prompts[questionIndex];

  const goToNextQuestion = useCallback(() => {
    setQuestionIndex((index) =>
      index + 1 < prompts.length ? index + 1 : index,
    );
  }, []);

  const resetGame = useCallback(() => {
    setIsPlaying(false);
    setIsFinished(false);
    setQuestionIndex(0);
    setInputLogs([]);
    setShowLogs(false);
    previousPerf.current = null;
  }, []);

  const showResult = useCallback(() => setIsFinished(true), []);

  return (
    <main className="app">
      <section className="panel">
        <p className="eyebrow">IPPO TYPING</p>
        <h1>一歩ずつ、正確に。</h1>

        {!isPlaying ? (
          <>
            <p className="description">準備ができたらプレイを開始してください。</p>
            <div className="actions">
              <button type="button" onClick={() => setIsPlaying(true)}>プレイ開始</button>
              <button className="secondary" type="button">直近のリプレイ</button>
            </div>
          </>
        ) : isFinished ? (
          <ResultView
            totalQuestions={prompts.length}
            inputLogs={inputLogs}
            onReset={resetGame}
          />
        ) : (
          <TypingArea
            key={currentPrompt.id}
            prompt={currentPrompt}
            questionNumber={questionIndex + 1}
            totalQuestions={prompts.length}
            onNext={goToNextQuestion}
            onResult={showResult}
            onReset={resetGame}
            onKeyLog={recordKey}
          />
        )}

        <button type="button" onClick={() => setShowLogs((open) => !open)}>
          {showLogs ? "ログを閉じる" : "ログを見る"}
        </button>
        {showLogs && <pre>{JSON.stringify(inputLogs, null, 2)}</pre>}
      </section>
    </main>
  );
}
