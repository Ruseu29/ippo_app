import { useCallback, useMemo, useRef, useState } from "react";
import { createAutocorrectMonitor, prepareCorrection, type CorrectionMatch } from "./autocorrect";
import { applyTypingKey, emptyTypingState, isTypingKey } from "./typingState";

type Options = {
  autocorrectEnabled: boolean;
  onKeyLog: (key: string, isInjected?: boolean) => void;
  onCorrectionMatch: (match: CorrectionMatch) => void;
};

// 画面は実打鍵を記録した後に inputKey を呼ぶ。修正操作の反映・記録はここで完結する。
export function useTypingInput({ autocorrectEnabled, onKeyLog, onCorrectionMatch }: Options) {
  const [input, setInput] = useState(emptyTypingState);
  const latestInput = useRef(emptyTypingState());
  const [correctionError, setCorrectionError] = useState("");
  const monitorInput = useMemo(() => createAutocorrectMonitor(match => {
    onCorrectionMatch(match);
    const steps = prepareCorrection(latestInput.current, match);
    if (!steps) {
      setCorrectionError("辞書の手順が修正先に一致しないため、自動修正を実行しませんでした。");
      return;
    }
    // OSへの疑似打鍵は送らず、アプリ内に1操作ずつ反映・記録する。
    // 注入キーを再監視せず、修正の連鎖や重複発火を防ぐ。
    for (const step of steps) {
      latestInput.current = step.state;
      onKeyLog(step.key, true);
    }
  }), [onCorrectionMatch, onKeyLog]);

  const inputKey = useCallback((key: string) => {
    if (!isTypingKey(key)) return;
    setCorrectionError("");
    latestInput.current = applyTypingKey(latestInput.current, key);
    if (autocorrectEnabled && key !== "Backspace") monitorInput(latestInput.current.rawInput);
    setInput(latestInput.current);
  }, [autocorrectEnabled, monitorInput]);

  return { ...input, inputKey, correctionError };
}
