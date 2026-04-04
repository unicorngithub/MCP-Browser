import { ipcMain } from 'electron'
import type { MCPHttpHeader, MCPServer } from '../../shared/types'
import { getMcpServers, setMcpServers } from './mcpStore'
import { callMcpTool, fetchMcpToolsList } from './mcpClient'

function parseHeadersIpc(raw: unknown): MCPHttpHeader[] | undefined {
  if (raw == null) return undefined
  if (!Array.isArray(raw)) return undefined
  const out: MCPHttpHeader[] = []
  for (const row of raw) {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) continue
    const n = (row as { name?: unknown }).name
    const v = (row as { value?: unknown }).value
    if (typeof n !== 'string' || typeof v !== 'string') continue
    out.push({ name: n, value: v })
  }
  return out.length ? out : undefined
}

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

  ipcMain.handle('mcp:fetch-tools', async (_evt, url: unknown, headers: unknown) => {
    try {
      if (typeof url !== 'string') {
        return { ok: false, error: '参数无效' } as const
      }
      const h = parseHeadersIpc(headers)
      return await fetchMcpToolsList(url, h)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false, error: message } as const
    }
  })

  ipcMain.handle(
    'mcp:call-tool',
    async (_evt, url: unknown, toolName: unknown, args: unknown, headers: unknown) => {
      try {
        if (typeof url !== 'string' || typeof toolName !== 'string') {
          return { ok: false, error: '参数无效' } as const
        }
        if (args === null || typeof args !== 'object' || Array.isArray(args)) {
          return { ok: false, error: 'arguments 须为 JSON 对象' } as const
        }
        const h = parseHeadersIpc(headers)
        return await callMcpTool(url, toolName, args as Record<string, unknown>, h)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return { ok: false, error: message } as const
      }
    },
  )
}
