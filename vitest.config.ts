import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "apps/web/src") },
  },
  test: {
    include: ["{apps,packages,config,scripts}/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**", "apps/web/e2e/**"],
    environment: "node",
  },
});
