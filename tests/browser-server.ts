// UI検証専用。短い問題とローカル模擬DBを使用し、本番には接続しない。
// pnpm exec tsx tests/browser-server.ts
import { createServer as createHttpServer } from "node:http";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import { createReplayApi } from "../src/logic/supabase";
import { samplePlay, samplePrompt } from "./fixtures";
import { createMockRest, createTestDatabase } from "./mockSupabase";
import prompts from "../src/data/prompts";

// 実際の作品一覧も、同じ模擬DBで確認できる。
const useStoryCatalog = process.env.IPPO_TEST_STORY_CATALOG === "1";
const db = await createTestDatabase();
const rest = createMockRest(db);
const client = createClient("http://test.invalid", "test-key", { global: { fetch: rest.fetch } });
const replayApi = createReplayApi(client, useStoryCatalog ? prompts.map(prompt => prompt.id) : [samplePrompt.id]);
if (!useStoryCatalog) for (let n = 1; n <= 12; n++) await replayApi.sendReplay(samplePlay(n));
rest.stats.writes = 0;
rest.failWrites(true);
const api = createHttpServer(async (request, response) => {
  if (request.url === "/stats") { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(rest.stats)); return; }
  if (request.url === "/allow-writes" && request.method === "POST") { rest.failWrites(false); response.end("{}"); return; }
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const result = await rest.fetch(`http://test.invalid${request.url}`, {
      method: request.method, headers: request.headers as Record<string, string>,
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
    });
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(await result.text());
  } catch (error) { response.statusCode = 500; response.end(JSON.stringify({ message: String(error) })); }
});
api.listen(5187, "127.0.0.1");
process.env.VITE_SUPABASE_URL = "http://localhost:5186/mock-supabase";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "local-test-key";
const vite = await createViteServer({ plugins: [{ name: "short-test-prompt", enforce: "pre", load(id) {
  if (!useStoryCatalog && id.replaceAll("\\", "/").endsWith("/src/data/prompts.ts")) {
    return `const prompts = ${JSON.stringify([{
      ...samplePrompt, text: "蚊詩", reading: "かし", baseScore: 100, source: { url: "https://example.com/test" },
    }])}; export const promptGroups = [{ id: "browser-test", title: "動作確認用の文章", prompts }]; export default prompts;`;
  }
} }], server: { host: "localhost", port: 5186, strictPort: true,
  proxy: { "/mock-supabase": { target: "http://127.0.0.1:5187", rewrite: path => path.replace(/^\/mock-supabase/, "") } },
} });
await vite.listen();
console.log("Replay UI test: http://localhost:5186 (local mock database only)");
