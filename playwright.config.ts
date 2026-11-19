import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
  webServer: {
    command: "VISUAL_TEST_MODE=true NEXT_PUBLIC_SUPABASE_URL=http://localhost NEXT_PUBLIC_SUPABASE_ANON_KEY=test npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/test-preview",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
