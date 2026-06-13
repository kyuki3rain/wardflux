import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages はリポジトリ名のサブパス配信のため base を合わせる。
// 環境変数 VITE_BASE で上書き可能（ユーザー/組織ページなら "/"）。
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? "/wardflux/",
});
