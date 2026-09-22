import { toKana } from "wanakana";
import romajiMap from "../data/romaji-map.json";

const mapping: Record<string, string> = { ...romajiMap, ",": "、", ".": "。" };
// 促音の ppo / tte など、エンジンが受け付ける入力も候補に含める。
const inputCandidates = Object.keys(mapping).flatMap((input) =>
  /^[bcdfghjklmpqrstvwxyz]/.test(input) ? [input, input[0] + input] : [input],
);

// 生入力を、平仮名＋まだ変換できないアルファベットへ変換する。
export function convertTypingInput(rawInput: string): string {
  return toKana(rawInput, {
    IMEMode: true,
    customKanaMapping: mapping,
  });
}

// 未完成の s / sh なども、正解へ続けられるなら間違いにしない。
function canContinue(rawInput: string, reading: string): boolean {
  const converted = convertTypingInput(rawInput);
  if (reading.startsWith(converted)) return true;

  const pending = converted.match(/[a-z]+$/)?.[0];
  if (!pending) return false;

  return inputCandidates.some((input) =>
    input.startsWith(pending) &&
    reading.startsWith(convertTypingInput(rawInput + input.slice(pending.length))),
  );
}

// 最初に正解から外れたキーと、変換結果の不一致位置を返す。
export function findTypingError(rawInput: string, reading: string) {
  const converted = convertTypingInput(rawInput);
  if (canContinue(rawInput, reading)) {
    return { rawIndex: rawInput.length, kanaIndex: converted.length };
  }

  let rawIndex = 0;
  while (rawIndex < rawInput.length && canContinue(rawInput.slice(0, rawIndex + 1), reading)) {
    rawIndex += 1;
  }

  let kanaIndex = 0;
  while (kanaIndex < converted.length && converted[kanaIndex] === reading[kanaIndex]) {
    kanaIndex += 1;
  }
  return { rawIndex, kanaIndex };
}

// 平仮名から、対応表で最初に見つかった入力を取得する。
function findInputForKana(kana: string): string | undefined {
  return Object.keys(mapping).find((input) => mapping[input] === kana);
}

// 削除後に残したい表示を、元の入力の前半＋対応表で組み直す。
function rebuildInput(target: string, rawInput: string): string | undefined {
  for (let end = rawInput.length; end >= 0; end -= 1) {
    const rawPrefix = rawInput.slice(0, end);
    const convertedPrefix = convertTypingInput(rawPrefix);

    if (!target.startsWith(convertedPrefix)) continue;

    const remainingKana = target.slice(convertedPrefix.length);
    if (remainingKana === "") return rawPrefix;

    const replacement = findInputForKana(remainingKana);
    if (replacement) return rawPrefix + replacement;
  }

  return undefined;
}

// 画面に見えている末尾1文字を消し、生入力を補正して返す。
export function deleteLastCharacter(rawInput: string): string {
  if (rawInput === "") return "";

  const converted = convertTypingInput(rawInput);
  const deletedCharacter = converted.slice(-1);
  const target = converted.slice(0, -1);

  // i → hi → dhi のように、生入力の末尾を少しずつ長くして調べる。
  for (let length = 1; length <= rawInput.length; length += 1) {
    const suffix = rawInput.slice(-length);

    // kなど対応表にない入力は、生データをそのまま判定に使う。
    const convertedSuffix = mapping[suffix] ?? suffix;
    if (!convertedSuffix.endsWith(deletedCharacter)) continue;

    const remainingKana = convertedSuffix.slice(0, -1);
    const replacement =
      remainingKana === "" ? "" : findInputForKana(remainingKana);

    if (remainingKana !== "" && !replacement) continue;

    const candidate = rawInput.slice(0, -length) + (replacement ?? "");
    if (convertTypingInput(candidate) === target) return candidate;
  }

  // kk → っk のように単純な末尾削除で戻せない場合だけ組み直す。
  return rebuildInput(target, rawInput) ?? rawInput.slice(0, -1);
}
