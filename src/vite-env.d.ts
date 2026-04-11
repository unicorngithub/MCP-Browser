/// <reference types="vite/client" />

import type {
  CallToolResult,
  ExportServersJsonResult,
  FetchToolsResult,
  ImportServersJsonResult,
  MCPHttpHeader,
  MCPServer,
  SetMcpServersResult,
} from '../shared/types'

import type { AppLanguage } from '../shared/locale'
import type { ThemePreference } from '../shared/theme'

export interface AppThemeApi {
  notifyPreferenceChanged(pref: ThemePreference): void
  onMenuSelect(handler: (pref: ThemePreference) => void): () => void
}

export interface AppLocaleApi {
  notifyLanguageChanged(lng: AppLanguage): void
}

export interface AppShellMenuApi {
  onCheckForUpdatesRequest(handler: () => void): () => void
  onUsageGuideRequest(handler: () => void): () => void
}

export interface McpDesktopApi {
  getServers(): Promise<MCPServer[]>
  setServers(list: MCPServer[]): Promise<SetMcpServersResult>
  fetchToolsList(url: string, headers?: MCPHttpHeader[], reuseSession?: boolean): Promise<FetchToolsResult>
  callTool(
    url: string,
    toolName: string,
    args: Record<string, unknown>,
    headers?: MCPHttpHeader[],
    reuseSession?: boolean,
  ): Promise<CallToolResult>
  exportServersJson(opts?: { redactHeaders?: boolean }): Promise<ExportServersJsonResult>
  importServersJson(): Promise<ImportServersJsonResult>
  onServersBackupMenuAction(handler: (action: 'export' | 'import') => void): () => void
}

/** 与 `electron/main/update.ts`、`electron/preload` 白名单保持一致 */
export type UpdaterInvokeChannel =
  | 'check-update'
  | 'cancel-check-update'
  | 'start-download'
  | 'quit-and-install'
export type UpdaterOnChannel =
  | 'update-can-available'
  | 'update-error'
  | 'download-progress'
  | 'update-downloaded'

export interface UpdaterIpcApi {
  invoke(channel: UpdaterInvokeChannel, ...args: unknown[]): Promise<unknown>
  on(channel: UpdaterOnChannel, listener: (event: unknown, ...args: unknown[]) => void): () => void
}

declare global {
  interface Window {
    mcpDesktop: McpDesktopApi
    updaterIpc: UpdaterIpcApi
    appTheme?: AppThemeApi
    appLocale?: AppLocaleApi
    appShellMenu?: AppShellMenuApi
  }
}

export {}
