import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: __dirname,
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/node_modules/**', 'dist/**'],
    /** E2E 用 `pnpm test:e2e`；`pnpm test` 在 package.json 中带 `--exclude test/e2e.spec.ts` */
    testTimeout: 1000 * 29,
  },
})
