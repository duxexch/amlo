import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["server/**/*.ts", "shared/**/*.ts"],
      exclude: ["server/vite.ts", "server/static.ts"],
    },
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
