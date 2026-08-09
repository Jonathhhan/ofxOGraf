import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: ".",
    testMatch: "ograf-package-lifecycle.spec.mjs",
    timeout: 30_000,
    retries: 0,
    workers: 1,
    reporter: "line",
    use: {
        baseURL: "http://127.0.0.1:8080",
        browserName: "chromium",
        headless: true,
        screenshot: "only-on-failure",
        trace: "retain-on-failure"
    }
});
