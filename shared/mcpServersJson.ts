import type { MCPHttpHeader, MCPServer } from './types'

export const MCP_SERVERS_EXPORT_VERSION = 1 as const

export interface McpServersExportFileV1 {
  version: typeof MCP_SERVERS_EXPORT_VERSION
  /** 导出时间（毫秒时间戳） */
  exportedAt: number
  servers: MCPServer[]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function parseHeadersLoose(v: unknown): MCPHttpHeader[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: MCPHttpHeader[] = []
  for (const row of v) {
    if (!isRecord(row)) continue
    const name = row.name
    const value = row.value
    if (typeof name !== 'string' || typeof value !== 'string') continue
    const n = name.trim()
    if (!n) continue
    out.push({ name: n, value })
  }
  return out.length ? out : undefined
}

function isValidHttpUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** 构建写入文件的导出对象（可选掩码请求头 value） */
export function buildMcpServersExportPayload(
  servers: MCPServer[],
  redactHeaders: boolean,
): McpServersExportFileV1 {
  const list: MCPServer[] = redactHeaders
    ? servers.map((s) => ({
        ...s,
        headers: s.headers?.map((h) => ({
          name: h.name,
          value: h.value ? '***' : '',
        })),
      }))
    : servers.map((s) => ({ ...s }))
  return {
    version: MCP_SERVERS_EXPORT_VERSION,
    exportedAt: Date.now(),
    servers: list,
  }
}

/**
 * 解析导入 JSON：支持 `{ version, servers }` 或裸 `servers` 数组。
 * 每项会分配新 id，避免与本地旧记录冲突。
 */
export function parseMcpServersImportJson(
  raw: unknown,
  newId: () => string,
): { ok: true; servers: MCPServer[] } | { ok: false; error: string } {
  let rows: unknown[]
  if (Array.isArray(raw)) {
    rows = raw
  } else if (isRecord(raw) && Array.isArray(raw.servers)) {
    rows = raw.servers
  } else {
    return { ok: false, error: 'JSON 须为数组，或包含 servers 数组的对象（如本应用导出格式）' }
  }

  const servers: MCPServer[] = []
  for (const item of rows) {
    if (!isRecord(item)) continue
    const url = typeof item.url === 'string' ? item.url.trim() : ''
    if (!url || !isValidHttpUrl(url)) continue
    const nameRaw = typeof item.name === 'string' ? item.name.trim() : ''
    const name = nameRaw || url
    const createdAt =
      typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
        ? item.createdAt
        : Date.now()
    const headers = parseHeadersLoose(item.headers)
    const entry: MCPServer = {
      id: newId(),
      name,
      url,
      createdAt,
      ...(headers?.length ? { headers } : {}),
    }
    servers.push(entry)
  }

  if (servers.length === 0) {
    return { ok: false, error: '没有有效项：每条至少需包含可解析的 http(s) url' }
  }
  return { ok: true, servers }
}
