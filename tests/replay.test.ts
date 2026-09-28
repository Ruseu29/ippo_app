import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReplayFrames, createReplayRecord, getReplayFrame, getReplayPrompt, isReplayRecord, replayUnavailableReason } from "../src/logic/replay";
import { createInputLog } from "../src/logic/logger";
import { convertTypingInput } from "../src/logic/typing";
import { injectedKanaFlags } from "../src/logic/typingState";
import prompts from "../src/data/prompts";
import { samplePlay, samplePrompt } from "./fixtures";

test("同時刻の文送り・無効なEnter・削除を操作順に再生する", () => {
  const record = samplePlay(1, ["k", "a", "Enter", "NextSentence", "s", "h", "i", "Backspace", "s", "i", "Finish"]);
  record.logs[3].perf = record.logs[2].perf;
  const frames = buildReplayFrames(record, samplePrompt);
  assert.equal(frames[3].sentenceIndex, 0);
  assert.equal(frames[4].sentenceIndex, 1);
  assert.equal(getReplayFrame(frames, 200).sentenceIndex, 1);
  assert.equal(frames[8].rawInput, "");
  assert.equal(convertTypingInput(frames.at(-1)!.rawInput), "し");
  assert.equal(frames.at(-1)!.isFinished, true);
  assert.equal(getReplayFrame(frames, 0).rawInput, "k");
});

test("本文は保存せず、現在の問題一覧からIDで解決する", () => {
  const record = samplePlay();
  assert.equal("prompt" in record, false);
  assert.equal("engine_version" in record, false);
  assert.equal(getReplayPrompt(record), undefined);
  record.prompt_id = prompts[0].id;
  assert.equal(getReplayPrompt(record), prompts[0]);
  assert.equal(replayUnavailableReason(samplePlay(), { ...samplePrompt, segments: [
    { text: "変更後の本文", reading: "へんこうご" }, samplePrompt.segments[1],
  ] }), null);
});

test("未対応版・壊れた順番・消えた文章を推測して再生しない", () => {
  const unknown = samplePlay();
  unknown.logs[0].version = "9.0";
  assert.match(replayUnavailableReason(unknown, samplePrompt)!, /未対応/);
  assert.match(replayUnavailableReason(samplePlay())!, /問題一覧/);
  assert.match(replayUnavailableReason(samplePlay(), { ...samplePrompt, segments: [samplePrompt.segments[0]] })!, /文数/);
  const bad = samplePlay();
  bad.logs[1].event_index = 0;
  assert.throws(() => createReplayRecord(bad.logs), /順序/);
  assert.equal(isReplayRecord({ ...bad, logs: [null] }), false);
  assert.throws(() => createReplayRecord(samplePlay().logs.slice(0, -1)), /終了/);
});

test("新規ログは1.2で、文送りは打鍵間隔を作らず位置情報を持つ", () => {
  const { log } = createInputLog("NextSentence", performance.now() - 100, "id", {
    prompt_id: samplePrompt.id, event_index: 2, sentence_number: 1,
  });
  assert.equal(log.delta_ms, null);
  assert.equal(log.version, "1.2");
  assert.equal(log.is_injected, false);
  assert.equal(log.prompt_id, samplePrompt.id);
  assert.equal(log.sentence_number, 1);
});

test("小数ミリ秒の最終イベントも正確な終端で再生完了になる", () => {
  const record = samplePlay();
  record.logs.at(-1)!.perf += 0.3;
  const frames = buildReplayFrames(record, samplePrompt);
  const end = frames.at(-1)!.atMs;
  assert.equal(getReplayFrame(frames, Math.floor(end)).isFinished, false);
  assert.equal(getReplayFrame(frames, end).isFinished, true);
});

test("修正ログを順番に再生して青文字を復元し、次の文で色をリセットする", () => {
  const record = samplePlay(30, ["d", "e", "u", "s", "Backspace", "Backspace", "s", "u", "NextSentence", "a", "Finish"]);
  for (let i = 4; i < 8; i++) record.logs[i] = { ...record.logs[i], is_injected: true, delta_ms: null };
  const frames = buildReplayFrames(createReplayRecord(record.logs), samplePrompt);
  assert.equal(frames[4].rawInput, "deus");
  assert.equal(frames[5].rawInput, "deu");
  assert.equal(frames[6].rawInput, "de");
  assert.equal(frames[8].rawInput, "desu");
  assert.deepEqual(injectedKanaFlags(frames[8]), [false, true]);
  assert.deepEqual(frames[9].injectedRaw, []);
  assert.deepEqual(frames[10].injectedRaw, [false]);
});

test("旧ログは通常入力として再生し、不正な注入フラグは受け付けない", () => {
  const record = samplePlay();
  record.logs.forEach(log => { log.version = "1.1"; delete log.is_injected; });
  assert.ok(buildReplayFrames(record, samplePrompt).every(frame => frame.injectedRaw.every(flag => !flag)));
  assert.equal(isReplayRecord({ ...record, logs: [{ ...record.logs[0], is_injected: "true" }] }), false);
  record.logs[0].is_injected = true;
  record.logs[0].delta_ms = 10;
  assert.throws(() => createReplayRecord(record.logs), /自動修正/);
});

test("1.2は注入フラグを必須とし、1.1と1.2の両方を再生できる", () => {
  const current = samplePlay();
  const legacy = samplePlay();
  legacy.logs.forEach(log => { log.version = "1.1"; delete log.is_injected; });
  assert.equal(replayUnavailableReason(current, samplePrompt), null);
  assert.equal(replayUnavailableReason(legacy, samplePrompt), null);
  assert.deepEqual(buildReplayFrames(current, samplePrompt), buildReplayFrames(legacy, samplePrompt));
  delete current.logs[0].is_injected;
  assert.equal(isReplayRecord(current), false);
});

test("注入ログはフラグを持ち、手入力の打鍵間隔を作らない", () => {
  const position = { prompt_id: samplePrompt.id, event_index: 4, sentence_number: 1 };
  const previous = performance.now() - 100;
  const injected = createInputLog("Backspace", previous, "id", position, true);
  const manual = createInputLog("u", previous, "id", { ...position, event_index: 5 });
  assert.equal(injected.log.is_injected, true);
  assert.equal(injected.log.delta_ms, null);
  assert.equal(manual.log.is_injected, false);
  assert.equal(manual.log.delta_ms, Math.round((manual.rawPerf - previous) * 10) / 10);
});
