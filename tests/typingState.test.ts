import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TypingDisplay from "../src/components/TypingDisplay";
import ResultView from "../src/components/ResultView";
import { applyTypingKey, emptyTypingState, injectedKanaFlags } from "../src/logic/typingState";
import { samplePlay } from "./fixtures";

test("注入したsuと対応するすだけを青色にし、後続の手入力には色を引き継がない", () => {
  let state = emptyTypingState();
  for (const key of "de") state = applyTypingKey(state, key);
  for (const key of "su") state = applyTypingKey(state, key, true);
  state = applyTypingKey(state, ".");
  assert.equal(state.rawInput, "desu.");
  assert.deepEqual(state.injectedRaw, [false, false, true, true, false]);
  assert.deepEqual(injectedKanaFlags(state), [false, true, false]);
  const markup = renderToStaticMarkup(createElement(TypingDisplay, {
    ...state, prompt: { title: "テスト", text: "です。", reading: "です。" }, sentenceNumber: 1, totalSentences: 1,
  }));
  assert.match(markup, /class="typing-injected"[^>]*>す<\/span>/);
  assert.equal((markup.match(/class="typing-injected"/g) ?? []).length, 3);
  assert.doesNotMatch(markup, /class="typing-error"/);
});

test("手動Backspaceで青文字も消え、打ち直した文字は通常色に戻る", () => {
  let state = emptyTypingState();
  for (const key of "desu") state = applyTypingKey(state, key, true);
  state = applyTypingKey(state, "Backspace");
  assert.equal(state.rawInput, "de");
  for (const key of "su") state = applyTypingKey(state, key);
  assert.deepEqual(state.injectedRaw, [true, true, false, false]);
  assert.deepEqual(injectedKanaFlags(state), [true, false]);
});

test("注入した未確定文字を手入力で完成しても由来を維持する", () => {
  let state = applyTypingKey(emptyTypingState(), "s", true);
  state = applyTypingKey(state, "u");
  assert.deepEqual(state.injectedRaw, [true, false]);
  assert.deepEqual(injectedKanaFlags(state), [true]);
});

test("促音と後続の子音を区別し、削除による生入力の再構築でも色を保つ", () => {
  let state = applyTypingKey(emptyTypingState(), "k", true);
  state = applyTypingKey(state, "k");
  state = applyTypingKey(state, "a");
  assert.deepEqual(injectedKanaFlags(state), [true, false]);
  state = applyTypingKey(state, "Backspace");
  assert.deepEqual(injectedKanaFlags(state), [true]);
  state = applyTypingKey(state, "a");
  assert.deepEqual(injectedKanaFlags(state), [true, false]);
});

test("自動修正の操作数や間隔を結果の手入力集計に混ぜない", () => {
  const record = samplePlay(30, ["d", "e", "u", "s", "Backspace", "Backspace", "s", "u", "Finish"]);
  for (let i = 4; i < 8; i++) record.logs[i] = { ...record.logs[i], is_injected: true, delta_ms: null };
  const markup = renderToStaticMarkup(createElement(ResultView, { totalQuestions: 1, inputLogs: record.logs, onReset() {}, onRetry() {} }));
  assert.match(markup, /打った回数：4回/);
  assert.match(markup, /Backspace：0回/);
  assert.match(markup, /入力間隔の中央値：100.0ms/);
});
