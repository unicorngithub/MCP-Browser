import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  type ElectronApplication,
  type Page,
  type JSHandle,
  _electron as electron,
} from 'playwright'
import type { BrowserWindow } from 'electron'
import {
  beforeAll,
  afterAll,
  describe,
  expect,
  test,
} from 'vitest'

/**
 * 官方 MCP 托管示例之一：Debug MCP App（Streamable HTTP）。
 * 根路径 `/mcp` 需 OAuth；`/debug/mcp` 在官方页面列出，可无 Token 演示 tools/list。
 * @see https://example-server.modelcontextprotocol.io/
 */
const DEMO_MCP_HTTP_URL = 'https://example-server.modelcontextprotocol.io/debug/mcp'
const DEMO_MCP_DISPLAY_NAME = 'Debug MCP（官方示例）'

const root = path.join(__dirname, '..')
const docsImagesDir = path.join(root, 'docs', 'images')

/** 仅在为 1/true 时写入 docs/images 与 test/screenshots（避免每次 pnpm test 改动配图） */
const shouldUpdateScreenshots =
  process.env.MCP_BROWSER_UPDATE_SCREENSHOTS === '1' ||
  process.env.MCP_BROWSER_UPDATE_SCREENSHOTS === 'true'

/** 本地无图形环境时可跳过；CI Linux 使用 `xvfb-run -a pnpm test:e2e` */
const skipE2e =
  process.env.MCP_BROWSER_SKIP_E2E === '1' || process.env.MCP_BROWSER_SKIP_E2E === 'true'

const describeE2e = skipE2e ? describe.skip : describe

let electronApp: ElectronApplication
let page: Page
let e2eUserDataDir: string

describeE2e('mcp-browser e2e', () => {
  beforeAll(async () => {
    e2eUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-dm-e2e-'))
    electronApp = await electron.launch({
      args: ['.', '--no-sandbox', `--user-data-dir=${e2eUserDataDir}`],
      cwd: root,
      env: { ...process.env, NODE_ENV: 'development' },
    })
    page = await electronApp.firstWindow()

    const mainWin: JSHandle<BrowserWindow> = await electronApp.browserWindow(page)
    await mainWin.evaluate(async (win) => {
      win.webContents.executeJavaScript('console.log("Execute JavaScript with e2e testing.")')
    })
  })

  afterAll(async () => {
    if (shouldUpdateScreenshots) {
      fs.mkdirSync(path.join(root, 'test', 'screenshots'), { recursive: true })
      fs.mkdirSync(docsImagesDir, { recursive: true })
      await page.screenshot({ path: path.join(root, 'test', 'screenshots', 'e2e.png') })
      await page.screenshot({ path: path.join(docsImagesDir, 'app-add-server.png') })
    }
    await page.close()
    await electronApp.close()
    fs.rmSync(e2eUserDataDir, { recursive: true, force: true })
  })

  test('startup', async () => {
    const title = await page.title()
    expect(title).eq('MCP BROWSER')
  })

  test(
    '连接官方 Debug MCP 示例端点并拉取 tools/list',
    async () => {
      await page.getByRole('button', { name: /添加端点/ }).click()
      await page.getByPlaceholder('示例：本地 MCP 服务').fill(DEMO_MCP_DISPLAY_NAME)
      await page.getByPlaceholder('https://example.com/mcp').fill(DEMO_MCP_HTTP_URL)
      await page.getByRole('button', { name: '保存' }).click()
      const header = page.getByTestId('mcp-tools-header')
      await header.waitFor({ state: 'visible', timeout: 15_000 })
      await expect((await header.textContent())?.trim()).toContain(DEMO_MCP_DISPLAY_NAME)
      await page.getByText('已连接').waitFor({ state: 'visible', timeout: 120_000 })
      await page.getByText(/\d+\s*个\s*工具/).waitFor({ state: 'visible', timeout: 15_000 })
    },
    150_000,
  )

  test('主窗口截图：工具列表 + 选中工具详情', async () => {
    const firstTool = page.getByTestId('mcp-tool-list').getByRole('button').first()
    await firstTool.waitFor({ state: 'visible', timeout: 15_000 })
    await firstTool.click()
    await page.getByText('工具调用').waitFor({ state: 'visible', timeout: 25_000 })
    if (shouldUpdateScreenshots) {
      fs.mkdirSync(docsImagesDir, { recursive: true })
      await page.screenshot({ path: path.join(docsImagesDir, 'app-window.png') })
    }
  })

  test('点击「添加端点」打开配置弹窗', async () => {
    await page.getByRole('button', { name: /添加端点/ }).click()
    const dialogTitle = await page.getByRole('heading', { name: '添加 MCP 端点' }).textContent()
    expect(dialogTitle?.trim()).eq('添加 MCP 端点')
  })
})
