import type { AppLanguage } from './locale'

export function interpolateTemplate(template: string, vars: Record<string, string>): string {
  let s = template
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{{${k}}}`).join(v)
  }
  return s
}

export type AppShellStrings = {
  /** 菜单与对话框文案 */
  file: string
  exportMcpConfig: string
  importMcpConfig: string
  closeWindow: string
  quit: string
  edit: string
  undo: string
  redo: string
  cut: string
  copy: string
  paste: string
  pasteAndMatchStyle: string
  selectAll: string
  view: string
  reload: string
  forceReload: string
  toggleDevTools: string
  actualSize: string
  zoomIn: string
  zoomOut: string
  toggleFullscreen: string
  settings: string
  appearance: string
  themeLight: string
  themeDark: string
  themeSystem: string
  window: string
  minimize: string
  zoom: string
  bringAllToFront: string
  help: string
  usageGuide: string
  mcpSpecOfficial: string
  aboutMcpBrowser: string
  macServices: string
  macHideOthers: string
  macShowAll: string
  /** macOS 应用菜单「关于 {{appName}}」 */
  macAboutApp: string
  macHideApp: string
  /** 原生关于面板版权（多行） */
  aboutPanelCopyright: string
  aboutDialogTitle: string
  /** showMessageBox detail，含 {{version}} */
  aboutDialogDetail: string
  usageDialogTitle: string
  usageDialogDetail: string
  dialogOk: string
  dialogExportServersTitle: string
  dialogImportServersTitle: string
  dialogJsonFilters: string
  dialogJsonParseFailed: string
}

const ZH: AppShellStrings = {
  file: '文件',
  exportMcpConfig: '导出 MCP 配置…',
  importMcpConfig: '导入 MCP 配置…',
  closeWindow: '关闭窗口',
  quit: '退出',
  edit: '编辑',
  undo: '撤销',
  redo: '重做',
  cut: '剪切',
  copy: '复制',
  paste: '粘贴',
  pasteAndMatchStyle: '粘贴并匹配样式',
  selectAll: '全选',
  view: '查看',
  reload: '重新加载',
  forceReload: '强制重新加载',
  toggleDevTools: '切换开发者工具',
  actualSize: '实际大小',
  zoomIn: '放大',
  zoomOut: '缩小',
  toggleFullscreen: '全屏',
  settings: '设置',
  appearance: '外观',
  themeLight: '浅色',
  themeDark: '深色',
  themeSystem: '跟随系统',
  window: '窗口',
  minimize: '最小化',
  zoom: '缩放',
  bringAllToFront: '前置全部窗口',
  help: '帮助',
  usageGuide: '使用说明',
  mcpSpecOfficial: 'MCP 规范（官方文档）',
  aboutMcpBrowser: '关于 MCP BROWSER',
  macServices: '服务',
  macHideOthers: '隐藏其他',
  macShowAll: '显示全部',
  macAboutApp: '关于 {{appName}}',
  macHideApp: '隐藏 {{appName}}',
  aboutPanelCopyright: "Copyright © Guo's\nMIT License — see LICENSE (upstream: NOTICE)",
  aboutDialogTitle: '关于 MCP BROWSER',
  aboutDialogDetail:
    "版本 {{version}}\n\n由 Guo's 维护。许可见 LICENSE；上游模板署名见 NOTICE。\n\n本软件按 MCP 公开规范与远端服务通信；规范文档可在菜单「帮助」中打开。",
  usageDialogTitle: '使用说明',
  usageDialogDetail:
    '在侧栏添加 MCP HTTP 端点；选中地址后会按协议拉取 tools 列表，可查看每个工具的说明与 inputSchema。\n\n菜单「文件」可导出/导入 MCP 配置 JSON（换机或备份）。\n\n系统相关选项（如浅色 / 深色 / 跟随系统外观）在菜单栏「设置」中；后续其他系统配置也会放在此处。\n\n开发者工具：Ctrl+Shift+I（macOS：Option+⌘+I）。',
  dialogOk: '确定',
  dialogExportServersTitle: '导出 MCP 地址配置',
  dialogImportServersTitle: '导入 MCP 地址配置',
  dialogJsonFilters: 'JSON',
  dialogJsonParseFailed: 'JSON 解析失败',
}

const EN: AppShellStrings = {
  file: 'File',
  exportMcpConfig: 'Export MCP configuration…',
  importMcpConfig: 'Import MCP configuration…',
  closeWindow: 'Close Window',
  quit: 'Quit',
  edit: 'Edit',
  undo: 'Undo',
  redo: 'Redo',
  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  pasteAndMatchStyle: 'Paste and Match Style',
  selectAll: 'Select All',
  view: 'View',
  reload: 'Reload',
  forceReload: 'Force Reload',
  toggleDevTools: 'Toggle Developer Tools',
  actualSize: 'Actual Size',
  zoomIn: 'Zoom In',
  zoomOut: 'Zoom Out',
  toggleFullscreen: 'Toggle Full Screen',
  settings: 'Settings',
  appearance: 'Appearance',
  themeLight: 'Light',
  themeDark: 'Dark',
  themeSystem: 'Match system',
  window: 'Window',
  minimize: 'Minimize',
  zoom: 'Zoom',
  bringAllToFront: 'Bring All to Front',
  help: 'Help',
  usageGuide: 'User Guide',
  mcpSpecOfficial: 'MCP specification (official)',
  aboutMcpBrowser: 'About MCP BROWSER',
  macServices: 'Services',
  macHideOthers: 'Hide Others',
  macShowAll: 'Show All',
  macAboutApp: 'About {{appName}}',
  macHideApp: 'Hide {{appName}}',
  aboutPanelCopyright: "Copyright © Guo's\nMIT License — see LICENSE (upstream: NOTICE)",
  aboutDialogTitle: 'About MCP BROWSER',
  aboutDialogDetail:
    "Version {{version}}\n\nMaintained by Guo's. See LICENSE; upstream credits in NOTICE.\n\nThis app talks to remote services using the public MCP specification; open the spec from the Help menu.",
  usageDialogTitle: 'User Guide',
  usageDialogDetail:
    'Add MCP HTTP endpoints in the sidebar; after selecting one, the app fetches the tool list per the protocol and shows each tool’s description and inputSchema.\n\nUse File → Export/Import MCP configuration JSON to move or back up servers.\n\nSystem options (light / dark / match system appearance) are under the Settings menu.\n\nDeveloper tools: Ctrl+Shift+I (macOS: Option+⌘+I).',
  dialogOk: 'OK',
  dialogExportServersTitle: 'Export MCP server list',
  dialogImportServersTitle: 'Import MCP server list',
  dialogJsonFilters: 'JSON',
  dialogJsonParseFailed: 'Invalid JSON',
}

export function getAppShellStrings(lng: AppLanguage): AppShellStrings {
  return lng === 'en' ? EN : ZH
}

export function formatAboutDialogDetail(s: AppShellStrings, version: string): string {
  return interpolateTemplate(s.aboutDialogDetail, { version })
}
