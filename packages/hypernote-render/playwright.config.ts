import { defineConfig } from "playwright/test";

export default defineConfig({
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  use: {
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
