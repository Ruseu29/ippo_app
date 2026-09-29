import { memo } from "react";
import type { InputLog } from "../types";

export default memo(function InputLogDisplay({ logs }: { logs: InputLog[] }) {
  return <div className="input-log-columns">
    <pre aria-label="入力ログ">{JSON.stringify(logs, null, 2)}</pre>
    <pre aria-label="キーだけのログ">{logs.map((log, index) =>
      <span key={index} className={log.is_injected === true ? "typing-injected" : undefined}>
        {JSON.stringify(log.event_key)}{"\n"}
      </span>,
    )}</pre>
  </div>;
});
