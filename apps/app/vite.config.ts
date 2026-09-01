import { fileURLToPath, URL } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import qiankun from "vite-plugin-qiankun";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: normalizeBase(env.VITE_PUBLIC_BASE),
    plugins: [react(), qiankun("mfe-app", { useDevMode: true })],
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts"
    },
    server: {
      port: 7201,
      strictPort: true,
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@tsuz/api": fileURLToPath(new URL("../../packages/api/src/index.ts", import.meta.url)),
        "@tsuz/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),
        "@tsuz/ui": fileURLToPath(new URL("../../packages/ui/src/index.tsx", import.meta.url))
      },
      dedupe: ["react", "react-dom"]
    }
  };
});

function normalizeBase(value: string | undefined) {
  const base = value?.trim() || "/";
  return base === "/" ? base : "/" + base.replace(/^\/+|\/+$/g, "") + "/";
}
