import { defineConfig } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: path.join(process.cwd(), "playwright"),
  outputDir: path.join(process.cwd(), "test-results", "playwright"),
  timeout: 30_000,
  webServer: {
    command: "npm run dev",
    port: 5174, // Use the correct Vite port
    reuseExistingServer: !process.env.CI,
  },
  use: {
    headless: true,
    baseURL: "http://localhost:5174", // Base URL for page.goto()
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
