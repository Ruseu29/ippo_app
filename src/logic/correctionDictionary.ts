import { prepareCorrection, type CorrectionDictionary } from "./autocorrect";
import { isTypingKey } from "./typingState";

export const formatCorrectionDictionary = (dictionary: CorrectionDictionary): string =>
  JSON.stringify(dictionary, null, 2) + "\n";

// 編集した辞書は、形式と置換手順を確認してから丸ごと適用する。
export function parseCorrectionDictionary(text: string): CorrectionDictionary {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new Error("JSONの形式が正しくありません。引用符やカンマを確認してください。"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("辞書は { } で囲んだJSONにしてください。");
  }
  return Object.fromEntries(Object.entries(value).map(([from, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`「${from}」に to と inputs を指定してください。`);
    }
    const { to, inputs } = value as Record<string, unknown>;
    if (!from || typeof to !== "string" || !Array.isArray(inputs) || !inputs.length ||
      inputs.some(key => typeof key !== "string" || !isTypingKey(key))) {
      throw new Error(`「${from}」の修正先・入力手順を確認してください。`);
    }
    if ([...from, ...to].some(key => !isTypingKey(key) || key !== key.toLowerCase()) || from === to) {
      throw new Error(`「${from}」の修正前・修正先は、入力可能な半角小文字・記号で別の文字列にしてください。`);
    }
    const rule = { to, inputs: inputs as string[] };
    const state = { rawInput: from, injectedRaw: Array(from.length).fill(false) };
    if (!prepareCorrection(state, { from, ...rule, rawInput: from, start: 0, end: from.length })) {
      throw new Error(`「${from}」の入力手順では「${to}」になりません。`);
    }
    return [from, rule];
  }));
}
