import { defineConfig } from 'vitest/config'

/** 仅跑 Playwright + Electron E2E；与主配置分离，避免把全局 testTimeout 拉到半分钟。 */
export default defineConfig({
  test: {
    root: __dirname,
    include: ['test/e2e.spec.ts'],
    exclude: ['**/node_modules/**', 'dist/**'],
    /** 官方示例外网用例单条可到 150s；留余量 */
    testTimeout: 180_000,
    /** beforeAll 起 Electron + 本地桩 */
    hookTimeout: 120_000,
  },
})
