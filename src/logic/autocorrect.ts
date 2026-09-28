import corrections from "../data/corrections.json";
import { applyTypingKey, isTypingKey, type TypingState } from "./typingState";

export type CorrectionRule = {
  to: string;
  // 左から順に実行するキー操作。Backspace は表示上の末尾1文字の削除。
  inputs: readonly string[];
};
export type CorrectionDictionary = Readonly<Record<string, CorrectionRule>>;

export type CorrectionMatch = CorrectionRule & {
  from: string;
  // 照合した生入力と、その中の対象範囲（end は範囲に含まない）。
  rawInput: string;
  start: number;
  end: number;
};

// 文字を追加した直後に呼ぶ。削除・再描画・リプレイからは呼ばない。
// 一致したら置換開始の受け口へ渡す。入力の書き換えはここでは行わない。
export function createAutocorrectMonitor(
  onMatch: (match: CorrectionMatch) => void,
  dictionary: CorrectionDictionary = corrections,
): (rawInput: string) => void {
  const rules = Object.entries(dictionary)
    .filter(([from, rule]) => from.length > 0 && from !== rule.to)
    // 同時に複数の末尾が一致する場合は、長い文字列を優先する。
    .sort(([a], [b]) => b.length - a.length);

  return (rawInput) => {
    const rule = rules.find(([from]) => rawInput.endsWith(from));
    if (!rule) return;

    const [from, { to, inputs }] = rule;
    onMatch({ from, to, inputs: [...inputs], rawInput, start: rawInput.length - from.length, end: rawInput.length });
  };
}

// 全手順を先に検証する。不正な辞書・古い一致結果では入力もログも途中変更しない。
export function prepareCorrection(state: TypingState, match: CorrectionMatch):
  { key: string; state: TypingState }[] | null {
  if (state.rawInput !== match.rawInput || match.end !== state.rawInput.length ||
    match.start < 0 || state.rawInput.slice(match.start, match.end) !== match.from) return null;
  let next = state;
  const steps = [];
  for (const key of match.inputs) {
    if (!isTypingKey(key)) return null;
    next = applyTypingKey(next, key, true);
    steps.push({ key, state: next });
  }
  return steps.length > 0 && next.rawInput === state.rawInput.slice(0, match.start) + match.to ? steps : null;
}
