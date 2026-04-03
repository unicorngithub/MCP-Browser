import ElectronStore from 'electron-store'
import type { MCPServer } from '../../shared/types'

type StoreSchema = { mcpServers: MCPServer[] }

/** 避免直接依赖 conf 的 moduleResolution；仅声明本应用用到的键 */
interface McpPersistStore {
  get(key: 'mcpServers'): MCPServer[]
  set(key: 'mcpServers', value: MCPServer[]): void
}

const store = new ElectronStore<StoreSchema>({
  name: 'mcp-browser',
  defaults: { mcpServers: [] },
}) as unknown as McpPersistStore

export function getMcpServers(): MCPServer[] {
  return store.get('mcpServers')
}

export function setMcpServers(servers: MCPServer[]): void {
  store.set('mcpServers', servers)
}
