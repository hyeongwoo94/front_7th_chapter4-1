import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "dot" : "html",
  use: {
    trace: "on-first-retry", // 실패한 테스트에 대해서만 trace 생성
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // serve:test가 모든 서버를 동시에 시작하므로, 첫 번째 항목만 명령어 실행
      command: "pnpm run serve:test",
      port: 5173, // DevCSR 서버 포트 (가장 먼저 시작됨)
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120 * 1000, // 빌드 시간을 고려하여 타임아웃 증가
    },
    {
      // 나머지 포트들은 serve:test로 함께 시작되므로 reuseExistingServer로 재사용
      command: "pnpm run serve:test",
      port: 4173, // ProdCSR 서버 포트
      reuseExistingServer: true, // 첫 번째 webServer가 이미 서버를 시작했으므로 재사용
      timeout: 120 * 1000,
    },
    {
      command: "pnpm run serve:test",
      port: 5174, // DevSSR 서버 포트
      reuseExistingServer: true,
      timeout: 120 * 1000,
    },
    {
      command: "pnpm run serve:test",
      port: 4174, // ProdSSR 서버 포트
      reuseExistingServer: true,
      timeout: 120 * 1000,
    },
    {
      command: "pnpm run serve:test",
      port: 4178, // SSG 서버 포트
      reuseExistingServer: true,
      timeout: 120 * 1000,
    },
  ],
});
