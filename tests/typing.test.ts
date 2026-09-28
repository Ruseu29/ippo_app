import assert from "node:assert/strict";
import { test } from "node:test";
import prompts from "../src/data/prompts";
import { convertTypingInput, getExampleRomaji } from "../src/logic/typing";

test("全作品の模範ローマ字を入力すると、出題の読みに一致する", () => {
  for (const prompt of prompts) {
    for (const segment of prompt.segments) {
      assert.equal(
        convertTypingInput(getExampleRomaji(segment.reading)),
        segment.reading,
        `${prompt.id}: ${segment.text}`,
      );
    }
  }
});
