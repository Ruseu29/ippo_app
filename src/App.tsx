import { useCallback, useRef, useState } from "react";
import ResultView from "./components/ResultView";
import CorrectionEditor from "./components/CorrectionEditor";
import TypingArea from "./components/TypingArea";
import ReplayHistory from "./components/ReplayHistory";
import ReplayView from "./components/ReplayView";
import InputLogDisplay from "./components/InputLogDisplay";
import { promptGroups } from "./data/prompts";
import defaultCorrections from "./data/corrections.json";
import { createInputLog, isPlayEvent, PLAY_EVENTS } from "./logic/logger";
import { createReplayRecord, getReplayPrompt } from "./logic/replay";
import { useReplayHistory } from "./logic/useReplayHistory";
import type { CorrectionDictionary, CorrectionMatch } from "./logic/autocorrect";
import type { InputLog, ReplayRecord } from "./types";

type CorrectionLog = CorrectionMatch & Pick<InputLog,
  "timestamp" | "event_key" | "event_index" | "prompt_id" | "sentence_number"
>;

export default function App() {
  const history = useReplayHistory();
  const { saveCompleted } = history;
  const [showHistory, setShowHistory] = useState(false);
  const [historyScope, setHistoryScope] = useState<"online" | "local">("online");
  const [replay, setReplay] = useState<ReplayRecord | null>(null);
  // Appが覚えておく状態
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [autocorrectEnabled, setAutocorrectEnabled] = useState(true);
  const [correctionDictionary, setCorrectionDictionary] = useState<CorrectionDictionary>(defaultCorrections);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const [selectedPromptIndex, setSelectedPromptIndex] = useState(0);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [inputLogs, setInputLogs] = useState<InputLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [correctionLogs, setCorrectionLogs] = useState<CorrectionLog[]>([]);
  const [showCorrectionLogs, setShowCorrectionLogs] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  // Stateの描画更新を待たず、最後のキーまで送信へ渡すための保持場所。
  const latestLogs = useRef<InputLog[]>([]);
  // 終了ログまで含めて確定し、送信の再試行でも同じ内容を使う。
  const completedLogs = useRef<InputLog[] | null>(null);
  const submissionStarted = useRef(false);
  const previousPerf = useRef<number | null>(null);
  const sessionId = useRef<string | null>(null);

  const currentGroup = promptGroups[selectedGroupIndex];
  const currentPrompt = currentGroup.prompts[selectedPromptIndex];
  const currentSentence = currentPrompt.segments[sentenceIndex];

  const recordKey = useCallback((key: string, isInjected = false) => {
    if (submissionStarted.current || completedLogs.current !== null) return;
    const { log, rawPerf } = createInputLog(
      key,
      previousPerf.current,
      sessionId.current,
      { prompt_id: currentPrompt.id, event_index: latestLogs.current.length, sentence_number: sentenceIndex + 1 },
      isInjected,
    );
    // 次の打鍵も、直前の実キー入力からの間隔を測る。
    if (!isInjected && !isPlayEvent(key)) previousPerf.current = rawPerf;
    latestLogs.current = [...latestLogs.current, log];
    setInputLogs(latestLogs.current);
  }, [sentenceIndex, currentPrompt.id]);

  const recordCorrection = useCallback((match: CorrectionMatch) => {
    if (!autocorrectEnabled || submissionStarted.current || completedLogs.current !== null) return;
    // 照合直前に記録した打鍵と同じ時刻・位置を使う。
    const keyLog = latestLogs.current.at(-1);
    if (!keyLog) return;
    const { timestamp, event_key, event_index, prompt_id, sentence_number } = keyLog;
    setCorrectionLogs(logs => [...logs, {
      timestamp, event_key, event_index, prompt_id, sentence_number, ...match,
    }]);
  }, [autocorrectEnabled]);

  const goToNextQuestion = useCallback(() => {
    if (submissionStarted.current || completedLogs.current !== null) return;
    if (sentenceIndex + 1 < currentPrompt.segments.length) {
      recordKey(PLAY_EVENTS.nextSentence);
      setSentenceIndex((index) => index + 1);
    }
  }, [sentenceIndex, currentPrompt, recordKey]);

  const startGame = useCallback(() => {
    sessionId.current = crypto.randomUUID();
    setCorrectionLogs([]);
    setShowCorrectionLogs(false);
    setIsPlaying(true);
  }, []);

  const resetGame = useCallback(() => {
    setIsPlaying(false);
    setIsFinished(false);
    setSentenceIndex(0);
    setInputLogs([]);
    latestLogs.current = [];
    completedLogs.current = null;
    submissionStarted.current = false;
    setIsSending(false);
    setSendError("");
    setShowLogs(false);
    setCorrectionLogs([]);
    setShowCorrectionLogs(false);
    previousPerf.current = null;
    sessionId.current = null;
  }, []);

  const showResult = useCallback(async () => {
    if (submissionStarted.current) return;
    if (completedLogs.current === null) {
      // 最後のキーの後、送信を開始する前に終了を記録する。
      recordKey(PLAY_EVENTS.finish);
      completedLogs.current = latestLogs.current;
    }
    submissionStarted.current = true;
    setIsSending(true);
    setSendError("");

    try {
      await saveCompleted(createReplayRecord(completedLogs.current));
      setIsFinished(true);
    } catch (error) {
      submissionStarted.current = false;
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : String(error);
      setSendError(`プレイを保存できませんでした：${message}`);
    } finally {
      setIsSending(false);
    }
  }, [recordKey, saveCompleted]);

  return (
    <main className="app">
      <section className="panel">
        {(!showHistory || replay) && <h1>{replay ? getReplayPrompt(replay)?.title ?? "リプレイ" : "ippo_app"}</h1>}

        {replay ? <ReplayView key={replay.session_id} record={replay} onBack={() => setReplay(null)} />
        : showHistory ? <ReplayHistory history={history} onOpen={setReplay} onBack={() => setShowHistory(false)}
          scope={historyScope} onScope={setHistoryScope} />
        : !isPlaying ? (
          <>
            <div className="actions">
              <button type="button" onClick={startGame}>プレイ開始</button>
              <button className="secondary" type="button" onClick={() => setShowHistory(true)}>直近のリプレイ</button>
              <button
                className={autocorrectEnabled ? undefined : "secondary"}
                type="button"
                aria-pressed={autocorrectEnabled}
                onClick={() => setAutocorrectEnabled(enabled => !enabled)}
              >
                自動修正の監視：{autocorrectEnabled ? "ON" : "OFF"}
              </button>
            </div>
            <div className="prompt-selection">
              <label className="label" htmlFor="story-select">作品</label>
              <select
                id="story-select"
                value={selectedGroupIndex}
                onChange={(event) => {
                  setSelectedGroupIndex(Number(event.target.value));
                  setSelectedPromptIndex(0);
                  setSentenceIndex(0);
                }}
              >
                {promptGroups.map((group, index) => (
                  <option key={group.id} value={index}>{group.title}（全{group.prompts.length}編）</option>
                ))}
              </select>
            </div>
            <div className="prompt-selection">
              <label className="label" htmlFor="prompt-select">選択した文章</label>
              <select
                id="prompt-select"
                value={selectedPromptIndex}
                onChange={(event) => setSelectedPromptIndex(Number(event.target.value))}
              >
                {currentGroup.prompts.map((prompt, index) => (
                  <option key={prompt.id} value={index}>{prompt.title}</option>
                ))}
              </select>
              <p>{currentPrompt.segments.length}文 · {currentPrompt.text.length}文字</p>
            </div>
            <CorrectionEditor dictionary={correctionDictionary} onApply={dictionary => {
              setCorrectionDictionary(dictionary); setAutocorrectEnabled(true);
            }} />
          </>
        ) : isFinished ? (
          <ResultView
            totalQuestions={1}
            inputLogs={inputLogs}
            onReset={resetGame}
            onRetry={() => { resetGame(); startGame(); }}
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
            isCompleted={completedLogs.current !== null}
            autocorrectEnabled={autocorrectEnabled}
            correctionDictionary={correctionDictionary}
            onNext={goToNextQuestion}
            onResult={showResult}
            onReset={resetGame}
            onKeyLog={recordKey}
            onCorrectionMatch={recordCorrection}
          />
        )}

        {isSending && <p role="status">送信中です。完了までお待ちください。</p>}
        {sendError && <p role="alert">{sendError}</p>}
        {history.localError && <p role="alert">{history.localError}</p>}
        {history.sendError && <p role="alert">オンライン送信は未完了です。{history.sendError}</p>}
        {history.local.some(item => item.sync_status === "pending") && <div className="sync-notice">
          <p>未送信のプレイが{history.local.filter(item => item.sync_status === "pending").length}件あります。</p>
          <button type="button" disabled={history.isSyncing || isSending}
            onClick={() => void history.retryPending()}>{history.isSyncing ? "送信中…" : "未送信分を再送"}</button>
        </div>}

        {!showHistory && !replay && <>
          <div className="actions">
            <button type="button" aria-expanded={showLogs} aria-controls="input-logs"
              onClick={() => setShowLogs(open => !open)}>
              {showLogs ? "ログを閉じる" : "ログを見る"}
            </button>
            <button type="button" aria-expanded={showCorrectionLogs} aria-controls="correction-logs"
              onClick={() => setShowCorrectionLogs(open => !open)}>
              {showCorrectionLogs ? "監視ログを閉じる" : "監視ログを見る"}（{correctionLogs.length}件）
            </button>
          </div>
          {showLogs && <div id="input-logs"><InputLogDisplay logs={inputLogs} /></div>}
          {showCorrectionLogs && <div id="correction-logs">
            <p>{!autocorrectEnabled ? "監視はOFFです。"
              : isFinished || completedLogs.current !== null ? "監視は終了しました。"
              : isPlaying ? "入力を監視中です。" : "プレイ開始後に入力を監視します。"}</p>
            <pre aria-label="監視ログ">{JSON.stringify(correctionLogs, null, 2)}</pre>
          </div>}
        </>}
      </section>
    </main>
  );
}
