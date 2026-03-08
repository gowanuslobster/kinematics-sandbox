import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "unit",
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/stories/**", "node_modules/**", "dist/**"],
    globals: true,
  },
});
