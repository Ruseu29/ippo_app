import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pagesのサブディレクトリでも、生成したファイルを読み込めるようにする。
  base: "./",
  plugins: [react()],
});
