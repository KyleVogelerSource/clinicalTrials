import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts", "src/**/*.test.ts"],
    exclude: ["src/**/*.integration.spec.ts", "**/node_modules/**"],
  },
});