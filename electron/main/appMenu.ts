import { app, BrowserWindow, Menu, nativeTheme, shell } from 'electron'
import { openExternalUrlIfAllowed } from './openExternalPolicy'
import type { MenuItemConstructorOptions } from 'electron'
import {
  escapeHtml,
  formatAboutWindowBodyHtml,
  getAppShellStrings,
  interpolateTemplate,
  MCP_BROWSER_REPOSITORY_URL,
  type AppShellStrings,
} from '../../shared/appShellStrings'
import type { AppLanguage } from '../../shared/locale'
import { getDefaultAppLanguage } from '../../shared/locale'
import type { ThemePreference } from '../../shared/theme'

export function syncNativeThemeSource(pref: ThemePreference): void {
  nativeTheme.themeSource = pref === 'system' ? 'system' : pref
}

let menuTheme: ThemePreference = 'system'
let menuLang: AppLanguage = getDefaultAppLanguage()

export function getMenuLanguage(): AppLanguage {
  return menuLang
}

function shellStrings(): AppShellStrings {
  return getAppShellStrings(menuLang)
}

function sendThemeToRenderer(pref: ThemePreference): void {
  const w = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (w && !w.isDestroyed()) w.webContents.send('app-menu:theme', pref)
}

/** MCP 公开规范文档（非商业推广，便于对照实现） */
function openMcpSpecification(): void {
  void shell.openExternal('https://modelcontextprotocol.io/specification/latest')
}

function openSourceRepository(): void {
  void shell.openExternal(MCP_BROWSER_REPOSITORY_URL)
}

let aboutBrowserWindow: BrowserWindow | null = null

/** Windows / Linux：HTML 关于窗口，仓库 URL 为可点击超链接（系统原生 MessageBox 无法在正文中放链接） */
function openNonMacAboutWindow(): void {
  const s = shellStrings()
  if (aboutBrowserWindow && !aboutBrowserWindow.isDestroyed()) {
    aboutBrowserWindow.focus()
    return
  }

  const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const bodyHtml = formatAboutWindowBodyHtml(s, app.getVersion())
  const titleEscaped = escapeHtml(s.aboutDialogTitle)
  const okEscaped = escapeHtml(s.dialogOk)

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<title>${titleEscaped}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", sans-serif;
    -webkit-font-smoothing: antialiased;
    font-size: 13px;
    line-height: 1.6;
    color: #18181b;
    background: #fafafa;
  }
  .shell {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 26px 12px 0;
    position: relative;
    overflow: visible;
    background: #fafafa;
  }
  .card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 420px;
    padding: 4px 14px 0;
    border-radius: 0;
    border: none;
    background: #fafafa;
    box-shadow: none;
  }
  .eyebrow {
    margin: 0 0 6px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: #0891b2;
  }
  .title {
    margin: 0 0 14px;
    font-size: 1.15rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: #09090b;
    line-height: 1.25;
  }
  .content p {
    margin: 0 0 12px;
    color: #52525b;
  }
  .content p:last-child { margin-bottom: 0; }
  .content p.meta {
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: #71717a;
    margin-bottom: 14px;
  }
  .content p.repo {
    margin-top: 2px;
    margin-bottom: 12px;
    padding: 0;
    border-radius: 0;
    border: none;
    background: transparent;
    color: #52525b;
    font-size: 12px;
    line-height: 1.55;
    white-space: normal;
  }
  .content .repo-label {
    white-space: nowrap;
  }
  a.repo-link {
    color: #0e7490;
    font-family: ui-monospace, "Cascadia Code", "Consolas", monospace;
    font-size: 11px;
    word-break: normal;
    overflow-wrap: anywhere;
    text-decoration: none;
    border-bottom: 1px solid rgba(8, 145, 178, 0.35);
    transition: color 0.15s ease, border-color 0.15s ease;
  }
  a.repo-link:hover {
    color: #155e75;
    border-bottom-color: rgba(8, 145, 178, 0.65);
  }
  .footer {
    margin-top: 16px;
    margin-bottom: 0;
    padding-bottom: 0;
    display: flex;
    justify-content: flex-end;
  }
  button#ok {
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    padding: 5px 16px;
    border: 1px solid #d4d4d8;
    border-radius: 8px;
    cursor: pointer;
    color: #3f3f46;
    background: #fafafa;
    box-shadow: none;
    transition: background 0.12s ease, border-color 0.12s ease;
  }
  button#ok:hover {
    background: #f4f4f5;
    border-color: #c4c4c9;
  }
  button#ok:active {
    background: #e4e4e7;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #09090b; color: #f4f4f5; }
    .shell { background: #09090b; }
    .card {
      background: #09090b;
    }
    .eyebrow { color: #22d3ee; }
    .title { color: #fafafa; }
    .content p { color: #a1a1aa; }
    .content p.meta { color: #71717a; }
    .content p.repo {
      border: none;
      background: transparent;
      color: #a1a1aa;
    }
    a.repo-link {
      color: #67e8f9;
      border-bottom-color: rgba(34, 211, 238, 0.4);
    }
    a.repo-link:hover {
      color: #a5f3fc;
      border-bottom-color: rgba(34, 211, 238, 0.75);
    }
    button#ok {
      color: #e4e4e7;
      background: #27272a;
      border-color: #3f3f46;
    }
    button#ok:hover {
      background: #3f3f46;
      border-color: #52525b;
    }
    button#ok:active {
      background: #3f3f46;
    }
  }
</style>
</head>
<body>
  <div class="shell">
    <div class="card">
      <p class="eyebrow">MCP BROWSER</p>
      <h1 class="title">${titleEscaped}</h1>
      <div class="content">${bodyHtml}</div>
      <div class="footer">
        <button type="button" id="ok">${okEscaped}</button>
      </div>
    </div>
  </div>
  <script>
    document.getElementById("ok").addEventListener("click", function () { window.close(); });
  </script>
</body>
</html>`

  const win = new BrowserWindow({
    parent: parent ?? undefined,
    modal: !!parent,
    useContentSize: true,
    width: 420,
    height: 260,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    title: s.aboutDialogTitle,
    autoHideMenuBar: true,
    backgroundColor: '#fafafa',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  aboutBrowserWindow = win
  win.on('closed', () => {
    if (aboutBrowserWindow === win) aboutBrowserWindow = null
  })

  win.webContents.on('will-navigate', (e, url) => {
    if (openExternalUrlIfAllowed(url)) e.preventDefault()
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalUrlIfAllowed(url)
    return { action: 'deny' }
  })

  /** 按文档实际高度收紧客户区，避免底部大块留白（确认键贴近窗口下沿） */
  const fitHeightToContent = (): void => {
    void win.webContents
      .executeJavaScript(
        `Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        )`,
        true,
      )
      .then((h: unknown) => {
        if (typeof h !== 'number' || !Number.isFinite(h)) {
          win.show()
          return
        }
        const [cw] = win.getContentSize()
        const nextH = Math.min(Math.max(Math.ceil(h), 200), 900)
        win.setContentSize(cw, nextH)
        win.show()
      })
      .catch(() => {
        win.show()
      })
  }

  win.webContents.once('did-finish-load', () => {
    // 主进程无 requestAnimationFrame；用 setImmediate 等一帧再量高，避免永远不 show
    setImmediate(() => {
      setImmediate(fitHeightToContent)
    })
  })
  void win.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`)
}

function showAbout(): void {
  const isMac = process.platform === 'darwin'
  if (isMac) {
    app.showAboutPanel()
    return
  }
  openNonMacAboutWindow()
}

/** 由菜单触发：通知当前窗口打开 MCP 配置导入/导出流程（渲染进程内对话框） */
function sendMcpServersBackupMenuAction(action: 'export' | 'import'): void {
  const w = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (w && !w.isDestroyed()) w.webContents.send('mcp-menu:servers-backup', action)
}

function sendCheckForUpdatesRequest(): void {
  const w = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (w && !w.isDestroyed()) w.webContents.send('app-menu:check-for-updates')
}

/** 使用说明改由渲染进程弹层展示，与主界面主题（浅/深）一致 */
function sendOpenUsageGuideRequest(): void {
  const w = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (w && !w.isDestroyed()) w.webContents.send('app-menu:usage-guide')
}

/**
 * 应用菜单：文件 / 编辑 / 显示 / 设置 / 帮助；macOS 另含应用菜单与「窗口」菜单。
 * Windows / Linux 单窗口，不重复提供「窗口」菜单（最小化等用标题栏即可）。
 * 「设置」集中系统配置类项；后续新增优先放此菜单。
 * @param themePref 与渲染进程 localStorage 同步，用于「设置 → 外观」单选项状态
 * @param language 界面语言；省略时保留当前值
 */
export function installAppMenu(themePref?: ThemePreference, language?: AppLanguage): void {
  if (themePref !== undefined) menuTheme = themePref
  if (language !== undefined) menuLang = language

  const s = shellStrings()
  const isMac = process.platform === 'darwin'

  app.setAboutPanelOptions({
    applicationName: 'MCP BROWSER',
    applicationVersion: app.getVersion(),
    copyright: s.aboutPanelCopyright,
    website: MCP_BROWSER_REPOSITORY_URL,
  })

  const macAppMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      {
        role: 'about',
        label: interpolateTemplate(s.macAboutApp, { appName: app.name }),
      },
      { type: 'separator' },
      { role: 'hide', label: interpolateTemplate(s.macHideApp, { appName: app.name }) },
      { role: 'hideOthers', label: s.macHideOthers },
      { role: 'unhide', label: s.macShowAll },
      { type: 'separator' },
      { role: 'quit', label: s.quit },
    ],
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [macAppMenu] : []),
    {
      label: s.file,
      submenu: [
        {
          label: s.exportMcpConfig,
          click: () => sendMcpServersBackupMenuAction('export'),
        },
        {
          label: s.importMcpConfig,
          click: () => sendMcpServersBackupMenuAction('import'),
        },
        { type: 'separator' },
        isMac
          ? { label: s.closeWindow, role: 'close', accelerator: 'Cmd+W' }
          : { label: s.quit, role: 'quit', accelerator: 'Ctrl+Q' },
      ],
    },
    {
      label: s.edit,
      submenu: [
        { label: s.undo, role: 'undo', accelerator: 'CmdOrCtrl+Z' },
        { label: s.redo, role: 'redo', accelerator: 'Shift+CmdOrCtrl+Z' },
        { type: 'separator' },
        { label: s.cut, role: 'cut', accelerator: 'CmdOrCtrl+X' },
        { label: s.copy, role: 'copy', accelerator: 'CmdOrCtrl+C' },
        { label: s.paste, role: 'paste', accelerator: 'CmdOrCtrl+V' },
      ],
    },
    {
      label: s.view,
      submenu: [
        { label: s.reload, role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { type: 'separator' },
        { label: s.actualSize, role: 'resetZoom' },
        { label: s.zoomIn, role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { label: s.zoomOut, role: 'zoomOut', accelerator: 'CmdOrCtrl+-' },
        { type: 'separator' },
        { label: s.toggleFullscreen, role: 'togglefullscreen', accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11' },
      ],
    },
    {
      label: s.settings,
      submenu: [
        {
          label: s.appearance,
          submenu: [
            {
              label: s.themeLight,
              type: 'radio',
              checked: menuTheme === 'light',
              click: () => {
                syncNativeThemeSource('light')
                installAppMenu('light')
                sendThemeToRenderer('light')
              },
            },
            {
              label: s.themeDark,
              type: 'radio',
              checked: menuTheme === 'dark',
              click: () => {
                syncNativeThemeSource('dark')
                installAppMenu('dark')
                sendThemeToRenderer('dark')
              },
            },
            {
              label: s.themeSystem,
              type: 'radio',
              checked: menuTheme === 'system',
              click: () => {
                syncNativeThemeSource('system')
                installAppMenu('system')
                sendThemeToRenderer('system')
              },
            },
          ],
        },
      ],
    },
    ...(isMac
      ? [
          {
            label: s.window,
            submenu: [
              { label: s.minimize, role: 'minimize', accelerator: 'Cmd+M' },
              { label: s.zoom, role: 'zoom' },
              { type: 'separator' as const },
              { role: 'front' as const, label: s.bringAllToFront },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: s.help,
      submenu: [
        {
          label: s.checkForUpdates,
          click: sendCheckForUpdatesRequest,
        },
        { type: 'separator' },
        {
          label: s.usageGuide,
          click: sendOpenUsageGuideRequest,
        },
        { type: 'separator' },
        {
          label: s.mcpSpecOfficial,
          click: openMcpSpecification,
        },
        {
          label: s.helpOpenSourceRepository,
          click: openSourceRepository,
        },
        { type: 'separator' },
        ...(!isMac
          ? [
              {
                label: s.aboutMcpBrowser,
                click: showAbout,
              },
            ]
          : []),
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
