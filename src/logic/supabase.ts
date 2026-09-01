import { createClient } from "@supabase/supabase-js";
import type { InputLog } from "../types";

// ブラウザから見えてよい接続情報だけを記入する。
// Secret key・service_role keyは置かない。アクセス制限はSupabase側で設定する。
export const supabaseConfig = {
  url: "https://tujbcuhqgujetaiidkse.supabase.co", // Project URL
  publishableKey: "sb_publishable_gUKu1JDetx_bkZ_015c7JA_Qt8w1q5X", // Publishable key（旧anon keyも利用可）
  tableName: "play_results", // 入力ログの保存先テーブル名
};

// 設定したプロジェクトを操作する窓口。ここではログを送信しない。
const supabase = createClient(
  supabaseConfig.url,
  supabaseConfig.publishableKey,
);

// 1打鍵＝1行として、ログ配列をまとめて送る。
export async function sendInputLogs(logs: InputLog[]): Promise<void> {
  if (logs.length === 0) return;

  const { error } = await supabase
    .from(supabaseConfig.tableName)
    .insert(logs);

  // 失敗を呼び出し元へ伝える。成功時はそのまま終了する。
  if (error) throw error;
}
