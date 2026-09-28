import type { InputLog } from "../src/types";
import { createReplayRecord } from "../src/logic/replay";

export const samplePrompt = {
  id: "browser-test", title: "動作確認用の文章",
  segments: [{ text: "蚊", reading: "か" }, { text: "詩", reading: "し" }],
};

export function samplePlay(n = 1, keys = ["k", "a", "NextSentence", "s", "i", "Finish"]) {
  const id = `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const started = Date.UTC(2026, 8, 23, 0, n);
  let sentence = 1;
  const logs: InputLog[] = keys.map((key, index) => {
    const progress = key === "NextSentence" || key === "Finish";
    const log: InputLog = {
      version: "1.2", session_id: id, prompt_id: samplePrompt.id,
      user_id: null, device_id: null, permission: "web_test",
      event_key: key, timestamp: new Date(started + index * 100).toISOString(),
      is_injected: false,
      perf: 1000 + index * 100, delta_ms: progress || index === 0 ? null : 100,
      event_index: index, sentence_number: sentence,
    };
    if (key === "NextSentence") sentence += 1;
    return log;
  });
  return createReplayRecord(logs);
}
