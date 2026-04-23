import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: __dirname,
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/node_modules/**', 'dist/**', 'test/e2e.spec.ts'],
    /** 单元测试；E2E 见 vitest.e2e.config.ts + `pnpm test:e2e` */
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
})
