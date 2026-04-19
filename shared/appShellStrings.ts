import type { AppLanguage } from './locale'

/** 应用开源仓库（关于面板、对话框与外链一致） */
export const MCP_BROWSER_REPOSITORY_URL = 'https://github.com/unicorngithub/MCP-Browser'

export function interpolateTemplate(template: string, vars: Record<string, string>): string {
  let s = template
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{{${k}}}`).join(v)
  }
  return s
}

/** 嵌入「关于」HTML 正文时对纯文本做转义 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
  view: string
  reload: string
  actualSize: string
  zoomIn: string
  zoomOut: string
  toggleFullscreen: string
  /** 显示 → 窗口模式 */
  windowModeLabel: string
  windowModeSingle: string
  windowModeMulti: string
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
  /** 帮助菜单：检查应用更新（GitHub Releases + electron-updater） */
  checkForUpdates: string
  usageGuide: string
  mcpSpecOfficial: string
  /** 帮助菜单：用系统默认方式打开开源仓库 URL */
  helpOpenSourceRepository: string
  aboutMcpBrowser: string
  macHideOthers: string
  macShowAll: string
  /** macOS 应用菜单「关于 {{appName}}」 */
  macAboutApp: string
  macHideApp: string
  /** 原生关于面板版权（多行） */
  aboutPanelCopyright: string
  aboutDialogTitle: string
  /** 非 macOS「关于」窗口正文（HTML 片段，含 {{version}}、{{repoUrl}}；链接由主进程包装） */
  aboutWindowBodyHtml: string
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
  view: '显示',
  reload: '刷新界面',
  actualSize: '实际大小',
  zoomIn: '放大',
  zoomOut: '缩小',
  toggleFullscreen: '全屏',
  windowModeLabel: '窗口模式',
  windowModeSingle: '单窗口模式',
  windowModeMulti: '多窗口模式',
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
  checkForUpdates: '检查更新',
  usageGuide: '使用说明',
  mcpSpecOfficial: 'MCP 规范（官方）',
  helpOpenSourceRepository: '源代码仓库（GitHub）',
  aboutMcpBrowser: '关于 MCP Browser',
  macHideOthers: '隐藏其他',
  macShowAll: '显示全部',
  macAboutApp: '关于 {{appName}}',
  macHideApp: '隐藏 {{appName}}',
  aboutPanelCopyright: "Copyright © Guo's\nMIT License — see LICENSE (upstream: NOTICE)",
  aboutDialogTitle: '关于 MCP Browser',
  aboutWindowBodyHtml:
    '<p class="meta">版本 {{version}}</p><p>由 Guo\'s 维护。许可条款见 LICENSE；上游模板署名见 NOTICE。</p><p class="repo"><span class="repo-label">源代码仓库：</span><a href="{{repoUrl}}" class="repo-link">{{repoUrl}}</a></p><p>本软件依据 MCP 公开规范与远端服务通信；完整规范可通过菜单「帮助」打开。</p>',
  dialogOk: '确定',
  dialogExportServersTitle: '导出 MCP 端点配置',
  dialogImportServersTitle: '导入 MCP 端点配置',
  dialogJsonFilters: 'JSON',
  dialogJsonParseFailed: 'JSON 解析失败',
}

const EN: AppShellStrings = {
  file: 'File',
  exportMcpConfig: 'Export MCP configuration…',
  importMcpConfig: 'Import MCP configuration…',
  closeWindow: 'Close Window',
  quit: 'Exit',
  edit: 'Edit',
  undo: 'Undo',
  redo: 'Redo',
  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  view: 'Display',
  reload: 'Refresh Interface',
  actualSize: 'Actual Size',
  zoomIn: 'Zoom In',
  zoomOut: 'Zoom Out',
  toggleFullscreen: 'Toggle Full Screen',
  windowModeLabel: 'Window mode',
  windowModeSingle: 'Single window',
  windowModeMulti: 'Multi-tab',
  settings: 'Settings',
  appearance: 'Appearance',
  themeLight: 'Light',
  themeDark: 'Dark',
  themeSystem: 'Match System',
  window: 'Window',
  minimize: 'Minimize',
  zoom: 'Zoom',
  bringAllToFront: 'Bring All to Front',
  help: 'Help',
  checkForUpdates: 'Check for Updates',
  usageGuide: 'User Guide',
  mcpSpecOfficial: 'MCP specification (official)',
  helpOpenSourceRepository: 'Source repository (GitHub)',
  aboutMcpBrowser: 'About MCP Browser',
  macHideOthers: 'Hide Others',
  macShowAll: 'Show All',
  macAboutApp: 'About {{appName}}',
  macHideApp: 'Hide {{appName}}',
  aboutPanelCopyright: "Copyright © Guo's\nMIT License — see LICENSE (upstream: NOTICE)",
  aboutDialogTitle: 'About MCP Browser',
  aboutWindowBodyHtml:
    '<p class="meta">Version {{version}}</p><p>Maintained by Guo\'s. Licensing terms are in LICENSE; upstream template credits are in NOTICE.</p><p class="repo"><span class="repo-label">Source repository: </span><a href="{{repoUrl}}" class="repo-link">{{repoUrl}}</a></p><p>This application communicates with remote services according to the public MCP specification; the full spec is available from the Help menu.</p>',
  dialogOk: 'OK',
  dialogExportServersTitle: 'Export MCP endpoint configuration',
  dialogImportServersTitle: 'Import MCP endpoint configuration',
  dialogJsonFilters: 'JSON',
  dialogJsonParseFailed: 'Invalid JSON',
}

export function getAppShellStrings(lng: AppLanguage): AppShellStrings {
  return lng === 'en' ? EN : ZH
}

export function formatAboutWindowBodyHtml(s: AppShellStrings, version: string): string {
  return interpolateTemplate(s.aboutWindowBodyHtml, {
    version: escapeHtml(version),
    repoUrl: MCP_BROWSER_REPOSITORY_URL,
  })
}
