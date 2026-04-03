import { app, BrowserWindow, Menu, shell } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'

/** MCP 公开规范文档（非商业推广，便于对照实现） */
function openMcpSpecification(): void {
  void shell.openExternal('https://modelcontextprotocol.io/specification/latest')
}

function showAbout(): void {
  const isMac = process.platform === 'darwin'
  if (isMac) {
    app.showAboutPanel()
    return
  }
  const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const opts = {
    type: 'info' as const,
    title: '关于 MCP BROWSER',
    message: 'MCP BROWSER',
    detail: `版本 ${app.getVersion()}\n\n由 Guo's 维护。许可见 LICENSE；上游模板署名见 NOTICE。\n\n本软件按 MCP 公开规范与远端服务通信；规范文档可在菜单「帮助」中打开。`,
    buttons: ['确定'],
    noLink: true,
  }
  void import('electron').then(({ dialog }) => {
    if (parent) void dialog.showMessageBox(parent, opts)
    else void dialog.showMessageBox(opts)
  })
}

function showUsageTips(): void {
  const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const opts = {
    type: 'info' as const,
    title: '使用说明',
    message: 'MCP BROWSER',
    detail:
      '在侧栏添加 MCP HTTP 端点；选中地址后会按协议拉取 tools 列表，可查看每个工具的说明与 inputSchema。\n\n开发者工具：Ctrl+Shift+I（macOS：Option+⌘+I）。',
    buttons: ['确定'],
    noLink: true,
  }
  void import('electron').then(({ dialog }) => {
    if (parent) void dialog.showMessageBox(parent, opts)
    else void dialog.showMessageBox(opts)
  })
}

/**
 * 应用菜单：文件 / 编辑 / 查看 / 窗口 / 帮助（macOS 首项为应用菜单）
 */
export function installAppMenu(): void {
  const isMac = process.platform === 'darwin'

  app.setAboutPanelOptions({
    applicationName: 'MCP BROWSER',
    applicationVersion: app.getVersion(),
    copyright: 'Copyright © Guo\'s\nMIT License — see LICENSE (upstream: NOTICE)',
    website: 'https://modelcontextprotocol.io',
  })

  const macAppMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about', label: `关于 ${app.name}` },
      { type: 'separator' },
      { role: 'services', label: '服务' },
      { type: 'separator' },
      { role: 'hide', label: `隐藏 ${app.name}` },
      { role: 'hideOthers', label: '隐藏其他' },
      { role: 'unhide', label: '显示全部' },
      { type: 'separator' },
      { role: 'quit', label: '退出' },
    ],
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [macAppMenu] : []),
    {
      label: '文件',
      submenu: [
        isMac
          ? { label: '关闭窗口', role: 'close', accelerator: 'Cmd+W' }
          : { label: '退出', role: 'quit', accelerator: 'Ctrl+Q' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo', accelerator: 'CmdOrCtrl+Z' },
        { label: '重做', role: 'redo', accelerator: 'Shift+CmdOrCtrl+Z' },
        { type: 'separator' },
        { label: '剪切', role: 'cut', accelerator: 'CmdOrCtrl+X' },
        { label: '复制', role: 'copy', accelerator: 'CmdOrCtrl+C' },
        { label: '粘贴', role: 'paste', accelerator: 'CmdOrCtrl+V' },
        { label: '粘贴并匹配样式', role: 'pasteAndMatchStyle', accelerator: 'CmdOrCtrl+Shift+V' },
        { type: 'separator' },
        { label: '全选', role: 'selectAll', accelerator: 'CmdOrCtrl+A' },
      ],
    },
    {
      label: '查看',
      submenu: [
        { label: '重新加载', role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { label: '强制重新加载', role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
        { type: 'separator' },
        {
          label: '切换开发者工具',
          role: 'toggleDevTools',
          accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
        },
        { type: 'separator' },
        { label: '实际大小', role: 'resetZoom' },
        { label: '放大', role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { label: '缩小', role: 'zoomOut', accelerator: 'CmdOrCtrl+-' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen', accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize', accelerator: isMac ? 'Cmd+M' : undefined },
        { label: '缩放', role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const, label: '前置全部窗口' },
            ]
          : []),
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '使用说明',
          click: showUsageTips,
        },
        { type: 'separator' },
        {
          label: 'MCP 规范（官方文档）',
          click: openMcpSpecification,
        },
        { type: 'separator' },
        ...(!isMac
          ? [
              {
                label: '关于 MCP BROWSER',
                click: showAbout,
              },
            ]
          : []),
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
