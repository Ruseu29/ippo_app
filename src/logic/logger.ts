import type { InputLog } from "../types";

let deviceId: string | null = null;
export function getDeviceId(): string {
  if (deviceId) return deviceId;
  try {
    deviceId = localStorage.getItem("ippo_device_id") || crypto.randomUUID();
    localStorage.setItem("ippo_device_id", deviceId);
  } catch {
    // 保存できない環境でも、このページ内では同じIDを使う。
    deviceId ??= crypto.randomUUID();
  }
  return deviceId;
}

// ログを作った時点の版を、端末保存・送信でも維持する。
export const LOG_VERSION = "1.2";
export const TEST_LOG_VERSION = "-11.0";
export const isSupportedLogVersion = (version: string): boolean =>
  version === "1.1" || version === LOG_VERSION || version === TEST_LOG_VERSION;

// 実際のキー入力と区別する、正常に受け付けられた進行操作。
export const PLAY_EVENTS = {
  nextSentence: "NextSentence",
  finish: "Finish",
} as const;

export function isPlayEvent(eventKey: string): boolean {
  return eventKey === PLAY_EVENTS.nextSentence || eventKey === PLAY_EVENTS.finish;
}

export function createInputLog(
  eventKey: string,
  previousPerf: number | null,
  sessionId: string | null,
  position?: { prompt_id: string; event_index: number; sentence_number: number },
  isInjected = false,
): { log: InputLog; rawPerf: number } {
  const rawPerf = performance.now();
  // 進行・注入操作は打鍵間隔の集計対象外。時刻自体はリプレイ用に残す。
  const delta =
    isInjected || isPlayEvent(eventKey) || previousPerf === null ? null : rawPerf - previousPerf;

  return {
    rawPerf,
    log: {
      version: position?.prompt_id === "test-1" ? TEST_LOG_VERSION : position ? LOG_VERSION : "1.0",
      session_id: sessionId,
      user_id: "guest",
      device_id: getDeviceId(),
      permission: "web_test",
      event_key: eventKey,
      is_injected: isInjected,
      timestamp: new Date().toISOString(),
      perf: Math.round(rawPerf * 10) / 10,
      delta_ms: delta === null ? null : Math.round(delta * 10) / 10,
      ...position,
    },
  };
}
