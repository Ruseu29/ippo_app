import { useCallback, useRef, useState } from "react";
import ResultView from "./components/ResultView";
import TypingArea from "./components/TypingArea";
import prompts from "./data/prompts.json";
import { createInputLog } from "./logic/logger";
import { sendInputLogs } from "./logic/supabase";
import type { InputLog } from "./types";

export default function App() {
  // Appが覚えておく状態
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [selectedPromptIndex, setSelectedPromptIndex] = useState(0);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [inputLogs, setInputLogs] = useState<InputLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  // Stateの描画更新を待たず、最後のキーまで送信へ渡すための保持場所。
  const latestLogs = useRef<InputLog[]>([]);
  const submissionStarted = useRef(false);
  const previousPerf = useRef<number | null>(null);
  const sessionId = useRef<string | null>(null);

  const recordKey = useCallback((key: string) => {
    if (submissionStarted.current) return;
    const { log, rawPerf } = createInputLog(
      key,
      previousPerf.current,
      sessionId.current,
    );
    previousPerf.current = rawPerf;
    latestLogs.current = [...latestLogs.current, log];
    setInputLogs(latestLogs.current);
  }, []);

  // 現在表示する問題
  const currentPrompt = prompts[selectedPromptIndex];
  const currentSentence = currentPrompt.segments[sentenceIndex];

  const goToNextQuestion = useCallback(() => {
    if (sentenceIndex + 1 < currentPrompt.segments.length) {
      setSentenceIndex((index) => index + 1);
    }
  }, [sentenceIndex, currentPrompt]);

  const startGame = useCallback(() => {
    sessionId.current = crypto.randomUUID();
    setIsPlaying(true);
  }, []);

  const resetGame = useCallback(() => {
    setIsPlaying(false);
    setIsFinished(false);
    setSentenceIndex(0);
    setInputLogs([]);
    latestLogs.current = [];
    submissionStarted.current = false;
    setIsSending(false);
    setSendError("");
    setShowLogs(false);
    previousPerf.current = null;
    sessionId.current = null;
  }, []);

  const showResult = useCallback(async () => {
    if (submissionStarted.current) return;
    submissionStarted.current = true;
    setIsSending(true);
    setSendError("");

    try {
      await sendInputLogs(latestLogs.current);
      setIsFinished(true);
    } catch (error) {
      submissionStarted.current = false;
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : String(error);
      setSendError(`送信に失敗しました：${message}`);
    } finally {
      setIsSending(false);
    }
  }, []);

  return (
    <main className="app">
      <section className="panel">
        <p className="eyebrow">IPPO TYPING</p>
        <h1>一歩ずつ、正確に。</h1>

        {!isPlaying ? (
          <>
            <p className="description">準備ができたらプレイを開始してください。</p>
            <div className="actions">
              <button type="button" onClick={startGame}>プレイ開始</button>
              <button className="secondary" type="button">直近のリプレイ</button>
            </div>
            <div className="prompt-selection">
              <label className="label" htmlFor="prompt-select">選択した文章</label>
              <select
                id="prompt-select"
                value={selectedPromptIndex}
                onChange={(event) => setSelectedPromptIndex(Number(event.target.value))}
              >
                {prompts.map((prompt, index) => (
                  <option key={prompt.id} value={index}>{prompt.title}</option>
                ))}
              </select>
              <p>{currentPrompt.segments.length}文 · {currentPrompt.text.length}文字</p>
            </div>
          </>
        ) : isFinished ? (
          <ResultView
            totalQuestions={1}
            inputLogs={inputLogs}
            onReset={resetGame}
          />
        ) : (
          <TypingArea
            key={`${currentPrompt.id}-${sentenceIndex}`}
            prompt={{ title: currentPrompt.title, ...currentSentence }}
            questionNumber={1}
            totalQuestions={1}
            sentenceNumber={sentenceIndex + 1}
            totalSentences={currentPrompt.segments.length}
            isSending={isSending}
            onNext={goToNextQuestion}
            onResult={showResult}
            onReset={resetGame}
            onKeyLog={recordKey}
          />
        )}

        {isSending && <p role="status">送信中です。完了までお待ちください。</p>}
        {sendError && <p role="alert">{sendError}</p>}

        <button type="button" onClick={() => setShowLogs((open) => !open)}>
          {showLogs ? "ログを閉じる" : "ログを見る"}
        </button>
        {showLogs && <pre>{JSON.stringify(inputLogs, null, 2)}</pre>}
      </section>
    </main>
  );
}
