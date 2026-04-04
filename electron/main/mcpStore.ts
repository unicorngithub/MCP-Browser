import { safeStorage } from 'electron'
import ElectronStore from 'electron-store'
import type { MCPServer, MCPHttpHeader } from '../../shared/types'

/** 落盘形态：明文 headers 或 safeStorage 加密块（二选一） */
type McpServerDisk = Omit<MCPServer, 'headers'> & {
  headers?: MCPHttpHeader[]
  headersCipher?: string
}

type StoreSchema = { mcpServers: McpServerDisk[] }

/** 避免直接依赖 conf 的 moduleResolution；仅声明本应用用到的键 */
interface McpPersistStore {
  get(key: 'mcpServers'): McpServerDisk[]
  set(key: 'mcpServers', value: McpServerDisk[]): void
}

const store = new ElectronStore<StoreSchema>({
  name: 'mcp-browser',
  defaults: { mcpServers: [] },
}) as unknown as McpPersistStore

function packHeaders(headers: MCPHttpHeader[] | undefined): Pick<McpServerDisk, 'headers' | 'headersCipher'> {
  if (!headers || headers.length === 0) return {}
  const trimmed = headers
    .map((h) => ({ name: h.name.trim(), value: h.value }))
    .filter((h) => h.name.length > 0)
  if (trimmed.length === 0) return {}

  const json = JSON.stringify(trimmed)
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buf = safeStorage.encryptString(json)
      return { headersCipher: buf.toString('base64') }
    }
  } catch (e) {
    console.warn('[mcpStore] safeStorage.encryptString 失败，回退明文', e)
  }
  return { headers: trimmed }
}

function unpackServer(row: McpServerDisk): MCPServer {
  let headers: MCPHttpHeader[] | undefined
  if (row.headersCipher) {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        console.warn('[mcpStore] 无法解密 headers：当前环境不支持 safeStorage')
      } else {
        const buf = Buffer.from(row.headersCipher, 'base64')
        const json = safeStorage.decryptString(buf)
        const parsed = JSON.parse(json) as unknown
        if (Array.isArray(parsed)) {
          headers = parsed.filter(
            (x): x is MCPHttpHeader =>
              x !== null &&
              typeof x === 'object' &&
              typeof (x as MCPHttpHeader).name === 'string' &&
              typeof (x as MCPHttpHeader).value === 'string',
          )
        }
      }
    } catch (e) {
      console.error('[mcpStore] headers 解密失败', e)
    }
  } else if (row.headers?.length) {
    headers = row.headers
  }

  return {
    id: row.id,
    name: row.name,
    url: row.url,
    createdAt: row.createdAt,
    ...(headers?.length ? { headers } : {}),
  }
}

function toDisk(server: MCPServer): McpServerDisk {
  const { headers, ...rest } = server
  const packed = packHeaders(headers)
  return { ...rest, ...packed }
}

export function getMcpServers(): MCPServer[] {
  try {
    const raw = store.get('mcpServers')
    return raw.map(unpackServer)
  } catch (e) {
    console.error('[mcp:getMcpServers]', e)
    return []
  }
}

export function setMcpServers(servers: MCPServer[]): void {
  store.set('mcpServers', servers.map(toDisk))
}
