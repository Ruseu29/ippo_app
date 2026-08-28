import type { InputLog } from "../types";

export function createInputLog(
  eventKey: string,
  previousPerf: number | null,
): { log: InputLog; rawPerf: number } {
  const rawPerf = performance.now();
  const delta = previousPerf === null ? null : rawPerf - previousPerf;

  return {
    rawPerf,
    log: {
      version: "1.0",
      user_id: null,
      device_id: null,
      permission: "web_test",
      event_key: eventKey,
      timestamp: new Date().toISOString(),
      perf: Math.round(rawPerf * 10) / 10,
      delta_ms: delta === null ? null : Math.round(delta * 10) / 10,
    },
  };
}
