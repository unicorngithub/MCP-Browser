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

const root = path.join(__dirname, '..')
let electronApp: ElectronApplication
let page: Page
let e2eUserDataDir: string

if (process.platform === 'linux') {
  // pass ubuntu
  test(() => expect(true).true)
} else {
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
    await page.screenshot({ path: 'test/screenshots/e2e.png' })
    await page.close()
    await electronApp.close()
    fs.rmSync(e2eUserDataDir, { recursive: true, force: true })
  })

  describe('mcp-browser e2e', () => {
    test('startup', async () => {
      const title = await page.title()
      expect(title).eq('MCP BROWSER')
    })

    test('主界面加载：工具区标题', async () => {
      const h1 = await page.locator('[data-testid="mcp-tools-header"]')
      const text = (await h1.textContent())?.trim()
      expect(text).eq('选择 MCP 服务')
    })

    test('点击「添加地址」打开配置弹窗', async () => {
      const addBtn = page.getByRole('button', { name: /添加地址/ })
      await addBtn.click()
      const dialogTitle = await page.getByRole('heading', { name: '添加 MCP 地址' }).textContent()
      expect(dialogTitle?.trim()).eq('添加 MCP 地址')
    })
  })
}
