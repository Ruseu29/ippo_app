import { convertTypingInput, deleteLastCharacter } from "./typing";

export type TypingState = { rawInput: string; injectedRaw: boolean[] };
export const emptyTypingState = (): TypingState => ({ rawInput: "", injectedRaw: [] });
export const isTypingKey = (key: string): boolean => key === "Backspace" || /^[a-zA-Z,.'?=-]$/.test(key);

function commonPrefix(a: string, b: string): number {
  let index = 0;
  while (index < a.length && a[index] === b[index]) index++;
  return index;
}

// 仮名がどの生入力からできたかを追う。拗音などは同じ入力範囲を共有する。
function kanaInputRanges(rawInput: string): { start: number; end: number }[] {
  let converted = "";
  let ranges: { start: number; end: number }[] = [];
  for (let index = 0; index < rawInput.length; index++) {
    const next = convertTypingInput(rawInput.slice(0, index + 1));
    const unchanged = commonPrefix(converted, next);
    const start = ranges[unchanged]?.start ?? index;
    const pendingLength = next.match(/[a-z]+$/)?.[0].length ?? 0;
    const kanaEnd = next.length - pendingLength;
    const pendingRawStart = index + 1 - pendingLength;
    ranges = [...ranges.slice(0, unchanged), ...Array.from(
      { length: next.length - unchanged }, (_, offset) => {
        const position = unchanged + offset;
        // っk の末尾kは、促音になった直前のkとは別の入力。
        if (position >= kanaEnd) {
          const rawIndex = pendingRawStart + position - kanaEnd;
          return { start: rawIndex, end: rawIndex + 1 };
        }
        return { start, end: pendingRawStart };
      },
    )];
    // kka → っか のように一度に確定した仮名も、ka → か を分離して由来を絞る。
    for (let kana = unchanged + 1; kana < kanaEnd; kana++) {
      for (let raw = index; raw > start; raw--) {
        if (convertTypingInput(rawInput.slice(raw, index + 1)) !== next.slice(kana)) continue;
        for (let before = unchanged; before < kana; before++) ranges[before].end = Math.min(ranges[before].end, raw);
        for (let after = kana; after < kanaEnd; after++) ranges[after].start = Math.max(ranges[after].start, raw);
        break;
      }
    }
    converted = next;
  }
  return ranges;
}

export function injectedKanaFlags(state: TypingState): boolean[] {
  if (!state.injectedRaw.some(Boolean)) return Array(convertTypingInput(state.rawInput).length).fill(false);
  return kanaInputRanges(state.rawInput).map(({ start, end }) => state.injectedRaw.slice(start, end).some(Boolean));
}

// 通常入力・自動修正・リプレイで、1キーの反映と文字の由来を共有する。
export function applyTypingKey(state: TypingState, key: string, isInjected = false): TypingState {
  if (!isTypingKey(key)) return state;
  if (key !== "Backspace") return {
    rawInput: state.rawInput + key.toLowerCase(), injectedRaw: [...state.injectedRaw, isInjected],
  };

  const rawInput = deleteLastCharacter(state.rawInput);
  const unchanged = commonPrefix(state.rawInput, rawInput);
  const injectedRaw = state.injectedRaw.slice(0, unchanged);
  if (unchanged < rawInput.length) {
    // っか → っ など、削除時に生入力が組み直された部分も残った仮名の由来を保つ。
    const remainingFlags = injectedKanaFlags(state).slice(0, convertTypingInput(rawInput).length);
    const ranges = kanaInputRanges(rawInput);
    for (let index = unchanged; index < rawInput.length; index++) {
      injectedRaw.push(ranges.some((range, kana) =>
        remainingFlags[kana] && range.start <= index && index < range.end));
    }
  }
  return { rawInput, injectedRaw };
}
