import prompts from "../data/prompts";
import type { InputLog, ReplayRecord } from "../types";
import { isPlayEvent, isSupportedLogVersion, LOG_VERSION, TEST_LOG_VERSION, PLAY_EVENTS } from "./logger";
import { applyTypingKey, emptyTypingState, isTypingKey, type TypingState } from "./typingState";

export const RECENT_REPLAY_LIMIT = 10;
export type ReplayPrompt = { id: string; title: string; segments: { text: string; reading: string }[] };
export const getReplayPrompt = (record: ReplayRecord): ReplayPrompt | undefined =>
  prompts.find(prompt => prompt.id === record.prompt_id);

const validDate = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));

export function isReplayRecord(value: unknown): value is ReplayRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as ReplayRecord;
  return r.schema_version === 2 && typeof r.session_id === "string" && r.session_id.length > 0 &&
    typeof r.prompt_id === "string" && r.prompt_id.length > 0 && validDate(r.started_at) &&
    validDate(r.finished_at) && Number.isFinite(r.started_perf) &&
    Array.isArray(r.logs) && r.logs.length > 0 && r.logs.every(l =>
      !!l && l.session_id === r.session_id && l.prompt_id === r.prompt_id &&
      typeof l.version === "string" && l.permission === "web_test" &&
      (l.user_id === null || typeof l.user_id === "string") &&
      (l.device_id === null || typeof l.device_id === "string") &&
      typeof l.event_key === "string" && validDate(l.timestamp) && Number.isFinite(l.perf) &&
      ((l.version !== LOG_VERSION && l.version !== TEST_LOG_VERSION && l.is_injected === undefined) || typeof l.is_injected === "boolean") &&
      (l.delta_ms === null || (Number.isFinite(l.delta_ms) && l.delta_ms >= 0)) &&
      Number.isInteger(l.event_index) && Number.isInteger(l.sentence_number));
}

// 文章の内容には依存せず、1プレイ分のログが最後まで揃っているか調べる。
export function logSequenceError(record: ReplayRecord): string | null {
  let sentence = 1;
  let previousPerf = record.started_perf;
  for (const [index, log] of record.logs.entries()) {
    if (log.event_index !== index || log.sentence_number !== sentence || log.perf < previousPerf) {
      return "ログの順序や文番号が一致しません。";
    }
    if (isPlayEvent(log.event_key) && log.delta_ms !== null) return "進行ログの形式が一致しません。";
    if (log.is_injected && (log.delta_ms !== null || !isTypingKey(log.event_key))) return "自動修正ログの形式が一致しません。";
    if (log.event_key === PLAY_EVENTS.finish && index !== record.logs.length - 1) return "終了後のログが含まれています。";
    if (log.event_key === PLAY_EVENTS.nextSentence) sentence += 1;
    previousPerf = log.perf;
  }
  return record.logs.at(-1)?.event_key === PLAY_EVENTS.finish ? null : "終了までのログが揃っていません。";
}

export function createReplayRecord(logs: InputLog[]): ReplayRecord {
  const sorted = [...logs].sort((a, b) => (a?.event_index ?? -1) - (b?.event_index ?? -1));
  const first = sorted[0];
  const record = {
    schema_version: 2, session_id: first?.session_id, prompt_id: first?.prompt_id,
    started_at: first?.timestamp, started_perf: first?.perf,
    finished_at: sorted.at(-1)?.timestamp, logs: sorted,
  };
  if (!isReplayRecord(record)) throw new Error("リプレイに必要な文章IDや位置情報がありません。");
  const reason = logSequenceError(record);
  if (reason) throw new Error(reason);
  return record;
}

export function replayUnavailableReason(record: ReplayRecord, prompt = getReplayPrompt(record)): string | null {
  if (!prompt) return "この文章は現在の問題一覧にありません。ログのみ閲覧できます。";
  if (record.logs.some(log => !isSupportedLogVersion(log.version))) return "未対応のログ形式です。ログのみ閲覧できます。";
  const reason = logSequenceError(record);
  if (reason) return reason;
  if (record.logs.at(-1)?.sentence_number !== prompt.segments.length) {
    return "現在の文章と文数が異なります。ログのみ閲覧できます。";
  }
  return null;
}

export type ReplayFrame = TypingState & { atMs: number; sentenceIndex: number; isFinished: boolean };

export function buildReplayFrames(record: ReplayRecord, prompt = getReplayPrompt(record)): ReplayFrame[] {
  const reason = replayUnavailableReason(record, prompt);
  if (reason) throw new Error(reason);
  const frames: ReplayFrame[] = [{ atMs: 0, sentenceIndex: 0, ...emptyTypingState(), isFinished: false }];
  for (const log of record.logs) {
    const frame = { ...frames[frames.length - 1], atMs: Math.max(0, log.perf - record.started_perf) };
    if (log.event_key === PLAY_EVENTS.nextSentence) {
      frame.sentenceIndex += 1;
      Object.assign(frame, emptyTypingState());
    } else if (log.event_key === PLAY_EVENTS.finish) frame.isFinished = true;
    else Object.assign(frame, applyTypingKey(frame, log.event_key, log.is_injected === true));
    frames.push(frame);
  }
  return frames;
}

export function getReplayFrame(frames: ReplayFrame[], atMs: number): ReplayFrame {
  let low = 0;
  let high = frames.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (frames[middle].atMs <= atMs) low = middle;
    else high = middle - 1;
  }
  return frames[low];
}

export function formatReplayTime(milliseconds: number): string {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
