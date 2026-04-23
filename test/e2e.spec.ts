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
import { startMcpE2eStubServer } from './mcpE2eStubServer'

/**
 * 默认：本机 HTTP 桩（无外网），CI 稳定。
 * 设 `MCP_BROWSER_E2E_USE_OFFICIAL=1` 或 `true` 时改连官方示例（需外网，用于手测回归）。
 * @see https://example-server.modelcontextprotocol.io/
 */
const OFFICIAL_MCP_HTTP_URL = 'https://example-server.modelcontextprotocol.io/debug/mcp'
const OFFICIAL_MCP_DISPLAY_NAME = 'Debug MCP（官方示例）'
const STUB_MCP_DISPLAY_NAME = 'E2E 本地 MCP 桩'

const root = path.join(__dirname, '..')
const docsImagesDir = path.join(root, 'docs', 'images')

/** 仅在为 1/true 时写入 docs/images 与 test/screenshots（避免每次 pnpm test 改动配图） */
const shouldUpdateScreenshots =
  process.env.MCP_BROWSER_UPDATE_SCREENSHOTS === '1' ||
  process.env.MCP_BROWSER_UPDATE_SCREENSHOTS === 'true'

/** 本地无图形环境时可跳过；CI Linux 使用 `xvfb-run -a pnpm test:e2e` */
const skipE2e =
  process.env.MCP_BROWSER_SKIP_E2E === '1' || process.env.MCP_BROWSER_SKIP_E2E === 'true'

const useOfficialDemo =
  process.env.MCP_BROWSER_E2E_USE_OFFICIAL === '1' ||
  process.env.MCP_BROWSER_E2E_USE_OFFICIAL === 'true'

const describeE2e = skipE2e ? describe.skip : describe

let electronApp: ElectronApplication
let page: Page
let e2eUserDataDir: string
let closeMcpStub: (() => Promise<void>) | undefined
let mcpHttpUrlForTest = ''
let mcpDisplayNameForTest = ''

describeE2e('mcp-browser e2e', () => {
  beforeAll(async () => {
    if (useOfficialDemo) {
      mcpHttpUrlForTest = OFFICIAL_MCP_HTTP_URL
      mcpDisplayNameForTest = OFFICIAL_MCP_DISPLAY_NAME
    } else {
      const stub = await startMcpE2eStubServer()
      mcpHttpUrlForTest = stub.mcpUrl
      mcpDisplayNameForTest = STUB_MCP_DISPLAY_NAME
      closeMcpStub = stub.close
    }

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
    await closeMcpStub?.()
    fs.rmSync(e2eUserDataDir, { recursive: true, force: true })
  })

  test('startup', async () => {
    const title = await page.title()
    expect(title).eq('MCP Browser')
  })

  test(
    useOfficialDemo
      ? '连接官方 Debug MCP 示例端点并拉取 tools/list'
      : '连接本地 MCP 桩并拉取 tools/list',
    async () => {
      await page.getByRole('button', { name: /添加端点/ }).click()
      await page.getByPlaceholder('示例：本地 MCP 服务').fill(mcpDisplayNameForTest)
      await page.getByPlaceholder('https://example.com/mcp').fill(mcpHttpUrlForTest)
      await page.getByRole('button', { name: '保存' }).click()
      const header = page.getByTestId('mcp-tools-header')
      await header.waitFor({ state: 'visible', timeout: 15_000 })
      await expect((await header.textContent())?.trim()).toContain(mcpDisplayNameForTest)
      const connectTimeout = useOfficialDemo ? 120_000 : 30_000
      // Streamable HTTP 成功为「列表正常」；SSE 就绪为「已连接」；英文界面为 List OK
      await page
        .getByText(/列表正常|已连接|List OK/)
        .waitFor({ state: 'visible', timeout: connectTimeout })
      await page.getByText(/\d+\s*个\s*工具/).waitFor({ state: 'visible', timeout: 15_000 })
    },
    useOfficialDemo ? 150_000 : 60_000,
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
