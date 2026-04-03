/// <reference types="vite/client" />

import type { CallToolResult, FetchToolsResult, MCPServer } from '../shared/types'

export interface McpDesktopApi {
  getServers(): Promise<MCPServer[]>
  setServers(list: MCPServer[]): Promise<void>
  fetchToolsList(url: string): Promise<FetchToolsResult>
  callTool(url: string, toolName: string, args: Record<string, unknown>): Promise<CallToolResult>
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
