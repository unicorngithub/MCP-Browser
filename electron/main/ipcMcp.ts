import { ipcMain } from 'electron'
import type { MCPServer } from '../../shared/types'
import { getMcpServers, setMcpServers } from './mcpStore'
import { callMcpTool, fetchMcpToolsList } from './mcpClient'

export function registerMcpIpc(): void {
  ipcMain.handle('mcp:get-servers', (): MCPServer[] => {
    try {
      return getMcpServers()
    } catch (e) {
      console.error('[mcp:get-servers]', e)
      return []
    }
  })

  ipcMain.handle('mcp:set-servers', (_evt, list: unknown) => {
    try {
      if (!Array.isArray(list)) return
      setMcpServers(list as MCPServer[])
    } catch (e) {
      console.error('[mcp:set-servers]', e)
    }
  })

  ipcMain.handle('mcp:fetch-tools', async (_evt, url: unknown) => {
    try {
      if (typeof url !== 'string') {
        return { ok: false, error: '参数无效' } as const
      }
      return await fetchMcpToolsList(url)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false, error: message } as const
    }
  })

  ipcMain.handle('mcp:call-tool', async (_evt, url: unknown, toolName: unknown, args: unknown) => {
    try {
      if (typeof url !== 'string' || typeof toolName !== 'string') {
        return { ok: false, error: '参数无效' } as const
      }
      if (args === null || typeof args !== 'object' || Array.isArray(args)) {
        return { ok: false, error: 'arguments 须为 JSON 对象' } as const
      }
      return await callMcpTool(url, toolName, args as Record<string, unknown>)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false, error: message } as const
    }
  })
}
