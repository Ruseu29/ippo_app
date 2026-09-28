import assert from "node:assert/strict";
import { test } from "node:test";
import defaults from "../src/data/corrections.json";
import { formatCorrectionDictionary, parseCorrectionDictionary } from "../src/logic/correctionDictionary";

test("既存辞書と疑問符の修正手順を、保存後も同じ内容で読み込める", () => {
  const dictionary = { ...defaults, "desu.": { to: "desu?", inputs: ["Backspace", "?"] } };
  assert.deepEqual(parseCorrectionDictionary(formatCorrectionDictionary(dictionary)), dictionary);
  assert.deepEqual(parseCorrectionDictionary("{}"), {});
});

test("不正なJSON・項目・未対応の入力を適用前に拒否する", () => {
  assert.throws(() => parseCorrectionDictionary("{"));
  for (const value of [null, [], 12, { deus: null }, { deus: [] },
    { deus: { to: 12, inputs: ["s"] } }, { deus: { to: "desu", inputs: [] } },
    { deus: { to: "desu", inputs: ["Escape"] } }, { deus: { to: "desu", inputs: [null] } },
    { "": { to: "desu", inputs: ["s"] } }, { DEUS: defaults.deus },
    { deus: { to: "です", inputs: ["s"] } }, { deus: { to: "deus", inputs: ["s"] } },
  ]) assert.throws(() => parseCorrectionDictionary(JSON.stringify(value)));
});

test("修正先に到達しない手順が1件でもあれば辞書全体を拒否する", () => {
  const dictionary = { ...defaults, wrong: { to: "right", inputs: ["Backspace", "s"] } };
  assert.throws(() => parseCorrectionDictionary(JSON.stringify(dictionary)), /入力手順では/);
});
