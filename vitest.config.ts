import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: { include: ["tests/unit/**/*.test.{ts,tsx}"], environment: "node", coverage: { reporter: ["text", "html"] } },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
