import assert from "node:assert/strict";
import { test } from "node:test";
import { createAutocorrectMonitor, prepareCorrection, type CorrectionMatch } from "../src/logic/autocorrect";
import corrections from "../src/data/corrections.json";
import { convertTypingInput, deleteLastCharacter } from "../src/logic/typing";
import { applyTypingKey, emptyTypingState, injectedKanaFlags } from "../src/logic/typingState";

test("deus が入力末尾に揃った打鍵で一度通知し、生入力は置換しない", () => {
  const matches: CorrectionMatch[] = [];
  const monitor = createAutocorrectMonitor(match => matches.push(match));
  let input = "";
  for (const key of "kyouhadeus.") {
    input += key;
    monitor(input);
    if (input.length < 10) assert.equal(matches.length, 0);
  }
  assert.deepEqual(matches, [
    {
      from: "deus", to: "desu", inputs: ["Backspace", "Backspace", "s", "u"],
      rawInput: "kyouhadeus", start: 6, end: 10,
    },
  ]);
  assert.equal(input, "kyouhadeus.");
});

test("部分一致・途中にある過去の一致・句読点を挟んだ文字は通知しない", () => {
  const matches: CorrectionMatch[] = [];
  const monitor = createAutocorrectMonitor(match => matches.push(match));
  for (const input of ["", "d", "de", "deu", "desu", "deusx", "de.us"]) monitor(input);
  assert.deepEqual(matches, []);
});

test("同時に一致した場合は最長の辞書項目だけを通知する", () => {
  const matches: CorrectionMatch[] = [];
  const monitor = createAutocorrectMonitor(match => matches.push(match), {
    us: { to: "su", inputs: ["Backspace", "Backspace", "s", "u"] },
    deus: corrections.deus,
    "": { to: "empty", inputs: [] },
    unchanged: { to: "unchanged", inputs: [] },
  });
  monitor("");
  monitor("unchanged");
  monitor("deus");
  assert.deepEqual(matches, [{
    from: "deus", to: "desu", inputs: ["Backspace", "Backspace", "s", "u"],
    rawInput: "deus", start: 0, end: 4,
  }]);
});

test("後続の別の一致は、それぞれの位置を通知する", () => {
  const matches: CorrectionMatch[] = [];
  const monitor = createAutocorrectMonitor(match => matches.push(match));
  let input = "";
  for (const key of "deus.deus") {
    input += key;
    monitor(input);
  }
  assert.deepEqual(matches.map(({ start, end }) => ({ start, end })), [
    { start: 0, end: 4 }, { start: 5, end: 9 },
  ]);
});

test("辞書の入力手順が表示1文字単位の削除で修正先に到達し、前の文章も保つ", () => {
  for (const [from, rule] of Object.entries(corrections)) {
    for (const prefix of ["", "kyouha"]) {
      let rawInput = prefix + from;
      for (const key of rule.inputs) {
        assert.ok(key === "Backspace" || /^[a-z,.'-]$/.test(key), `未対応のキー：${key}`);
        rawInput = key === "Backspace" ? deleteLastCharacter(rawInput) : rawInput + key;
      }
      assert.equal(rawInput, prefix + rule.to);
      assert.equal(convertTypingInput(rawInput), convertTypingInput(prefix + rule.to));
    }
  }
});

test("deus の修正は、でうs → でう → で → でs → です の順に進む", () => {
  let rawInput = "deus";
  const displayed = [convertTypingInput(rawInput)];
  for (const key of corrections.deus.inputs) {
    rawInput = key === "Backspace" ? deleteLastCharacter(rawInput) : rawInput + key;
    displayed.push(convertTypingInput(rawInput));
  }
  assert.deepEqual(displayed, ["でうs", "でう", "で", "でs", "です"]);
});

test("修正手順は4操作を順番に返し、元の入力と手入力部分の由来を保つ", () => {
  let state = emptyTypingState();
  for (const key of "kyouhadeus") state = applyTypingKey(state, key);
  const original = structuredClone(state);
  const match: CorrectionMatch = { from: "deus", ...corrections.deus, rawInput: state.rawInput, start: 6, end: 10 };
  const steps = prepareCorrection(state, match)!;
  assert.deepEqual(steps.map(step => step.key), ["Backspace", "Backspace", "s", "u"]);
  assert.deepEqual(steps.map(step => step.state.rawInput), ["kyouhadeu", "kyouhade", "kyouhades", "kyouhadesu"]);
  assert.deepEqual(steps.at(-1)!.state.injectedRaw, [...Array(8).fill(false), true, true]);
  assert.deepEqual(injectedKanaFlags(steps.at(-1)!.state), [false, false, false, false, false, true]);
  assert.deepEqual(state, original);
  assert.equal(prepareCorrection(state, { ...match, rawInput: "old" }), null);
  assert.equal(prepareCorrection(state, { ...match, inputs: ["Backspace", "x"] }), null);
  assert.equal(prepareCorrection(state, { ...match, inputs: ["Finish"] }), null);
  assert.deepEqual(state, original);
});
