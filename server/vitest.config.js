import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // include JS and MJS test files so ESM tests like export_text.test.mjs are picked up
    include: ["__tests__/**/*.test.js", "__tests__/**/*.test.mjs"],
    globals: true,
    environment: "node",
  },
});
