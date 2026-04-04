import { app, BrowserWindow, Menu, nativeTheme, shell } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import {
  formatAboutDialogDetail,
  getAppShellStrings,
  interpolateTemplate,
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

function showAbout(): void {
  const s = shellStrings()
  const isMac = process.platform === 'darwin'
  if (isMac) {
    app.showAboutPanel()
    return
  }
  const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const opts = {
    type: 'info' as const,
    title: s.aboutDialogTitle,
    message: 'MCP BROWSER',
    detail: formatAboutDialogDetail(s, app.getVersion()),
    buttons: [s.dialogOk],
    noLink: true,
  }
  void import('electron').then(({ dialog }) => {
    if (parent) void dialog.showMessageBox(parent, opts)
    else void dialog.showMessageBox(opts)
  })
}

/** 由菜单触发：通知当前窗口打开 MCP 配置导入/导出流程（渲染进程内对话框） */
function sendMcpServersBackupMenuAction(action: 'export' | 'import'): void {
  const w = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (w && !w.isDestroyed()) w.webContents.send('mcp-menu:servers-backup', action)
}

function showUsageTips(): void {
  const s = shellStrings()
  const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const opts = {
    type: 'info' as const,
    title: s.usageDialogTitle,
    message: 'MCP BROWSER',
    detail: s.usageDialogDetail,
    buttons: [s.dialogOk],
    noLink: true,
  }
  void import('electron').then(({ dialog }) => {
    if (parent) void dialog.showMessageBox(parent, opts)
    else void dialog.showMessageBox(opts)
  })
}

/**
 * 应用菜单：文件 / 编辑 / 查看 / 设置 / 窗口 / 帮助（macOS 首项为应用菜单）
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
    website: 'https://modelcontextprotocol.io',
  })

  const macAppMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      {
        role: 'about',
        label: interpolateTemplate(s.macAboutApp, { appName: app.name }),
      },
      { type: 'separator' },
      { role: 'services', label: s.macServices },
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
        { label: s.pasteAndMatchStyle, role: 'pasteAndMatchStyle', accelerator: 'CmdOrCtrl+Shift+V' },
        { type: 'separator' },
        { label: s.selectAll, role: 'selectAll', accelerator: 'CmdOrCtrl+A' },
      ],
    },
    {
      label: s.view,
      submenu: [
        { label: s.reload, role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { label: s.forceReload, role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
        { type: 'separator' },
        {
          label: s.toggleDevTools,
          role: 'toggleDevTools',
          accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
        },
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
    {
      label: s.window,
      submenu: [
        { label: s.minimize, role: 'minimize', accelerator: isMac ? 'Cmd+M' : undefined },
        { label: s.zoom, role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const, label: s.bringAllToFront },
            ]
          : []),
      ],
    },
    {
      label: s.help,
      submenu: [
        {
          label: s.usageGuide,
          click: showUsageTips,
        },
        { type: 'separator' },
        {
          label: s.mcpSpecOfficial,
          click: openMcpSpecification,
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
