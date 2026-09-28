import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pagesのサブディレクトリでも、生成したファイルを読み込めるようにする。
  base: "./",
  plugins: [react()],
  // C側の実行環境から参照したソースも、C側の依存関係を使う。
  resolve: { preserveSymlinks: process.env.IPPO_LOCAL_ENV === "1" },
});
