import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { getAppShellStrings } from '../../shared/appShellStrings'
import { MCP_IPC_USER_CANCELLED } from '../../shared/mcpIpc'
import { buildMcpServersExportPayload, parseMcpServersImportJson } from '../../shared/mcpServersJson'
import type {
  ExportServersJsonResult,
  ImportServersJsonResult,
  MCPHttpHeader,
  MCPServer,
} from '../../shared/types'
import { getMenuLanguage } from './appMenu'
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

  ipcMain.handle(
    'mcp:export-servers-json',
    async (event, opts: unknown): Promise<ExportServersJsonResult> => {
      try {
        const redact =
          opts !== null &&
          typeof opts === 'object' &&
          !Array.isArray(opts) &&
          (opts as { redactHeaders?: unknown }).redactHeaders === true
        const win = BrowserWindow.fromWebContents(event.sender)
        const list = getMcpServers()
        const payload = buildMcpServersExportPayload(list, redact)
        const day = new Date().toISOString().slice(0, 10)
        const shell = getAppShellStrings(getMenuLanguage())
        const saveOpts = {
          title: shell.dialogExportServersTitle,
          defaultPath: `mcp-browser-servers-${day}.json`,
          filters: [{ name: shell.dialogJsonFilters, extensions: ['json'] }],
        }
        const { filePath, canceled } = win
          ? await dialog.showSaveDialog(win, saveOpts)
          : await dialog.showSaveDialog(saveOpts)
        if (canceled || !filePath) {
          return { ok: false, error: MCP_IPC_USER_CANCELLED }
        }
        await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
        return { ok: true }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        console.error('[mcp:export-servers-json]', e)
        return { ok: false, error: message }
      }
    },
  )

  ipcMain.handle(
    'mcp:import-servers-json',
    async (event): Promise<ImportServersJsonResult> => {
      try {
        const win = BrowserWindow.fromWebContents(event.sender)
        const shell = getAppShellStrings(getMenuLanguage())
        const openOpts: OpenDialogOptions = {
          title: shell.dialogImportServersTitle,
          properties: ['openFile'],
          filters: [{ name: shell.dialogJsonFilters, extensions: ['json'] }],
        }
        const { filePaths, canceled } = win
          ? await dialog.showOpenDialog(win, openOpts)
          : await dialog.showOpenDialog(openOpts)
        if (canceled || !filePaths?.[0]) {
          return { ok: false, error: MCP_IPC_USER_CANCELLED }
        }
        const text = await fs.readFile(filePaths[0], 'utf8')
        let json: unknown
        try {
          json = JSON.parse(text) as unknown
        } catch {
          return { ok: false, error: shell.dialogJsonParseFailed }
        }
        const parsed = parseMcpServersImportJson(json, () => randomUUID())
        if (!parsed.ok) return parsed
        return { ok: true, servers: parsed.servers, count: parsed.servers.length }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        console.error('[mcp:import-servers-json]', e)
        return { ok: false, error: message }
      }
    },
  )
}
