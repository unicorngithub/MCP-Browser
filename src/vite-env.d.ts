/// <reference types="vite/client" />

import type {
  CallToolResult,
  ExportServersJsonResult,
  FetchToolsResult,
  ImportServersJsonResult,
  MCPHttpHeader,
  MCPServer,
} from '../shared/types'

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
  }
}

export {}
