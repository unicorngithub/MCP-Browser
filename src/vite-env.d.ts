/// <reference types="vite/client" />

import type {
  CallToolResult,
  ExportServersJsonResult,
  FetchToolsResult,
  ImportServersJsonResult,
  MCPHttpHeader,
  MCPServer,
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

export interface McpDesktopApi {
  getServers(): Promise<MCPServer[]>
  setServers(list: MCPServer[]): Promise<void>
  fetchToolsList(url: string, headers?: MCPHttpHeader[]): Promise<FetchToolsResult>
  callTool(
    url: string,
    toolName: string,
    args: Record<string, unknown>,
    headers?: MCPHttpHeader[],
  ): Promise<CallToolResult>
  exportServersJson(opts?: { redactHeaders?: boolean }): Promise<ExportServersJsonResult>
  importServersJson(): Promise<ImportServersJsonResult>
  onServersBackupMenuAction(handler: (action: 'export' | 'import') => void): () => void
}

export interface UpdaterIpcApi {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
  on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): () => void
}

declare global {
  interface Window {
    mcpDesktop: McpDesktopApi
    updaterIpc: UpdaterIpcApi
    appTheme?: AppThemeApi
    appLocale?: AppLocaleApi
  }
}

export {}
