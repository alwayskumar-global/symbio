import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:18763",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "../.venv/bin/symbio serve",
    url: "http://127.0.0.1:18763",
    env: { SYMBIO_PORT: "18763", SYMBIO_WORK_PATH: "var/browser-test.rl" },
    reuseExistingServer: false,
  },
});
