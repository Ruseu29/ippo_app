export type InputLog = {
  version: "1.0";
  user_id: string | null;
  device_id: string | null;
  permission: "web_test";
  event_key: string;
  timestamp: string;
  perf: number;
  delta_ms: number | null;
};
