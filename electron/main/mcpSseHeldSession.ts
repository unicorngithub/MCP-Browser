import type { LegacySseBridge } from './mcpLegacySseBridge'

/** 与 tools/list、多次 tools/call 共用的 SSE + POST 基址 + MCP 会话 */
export type SseHeldEntry = {
  bridge: LegacySseBridge
  postHref: string
  sessionId: string | null
  userHeaders: Record<string, string>
  lastUsedAt: number
  /** tools/call 的 JSON-RPC id，在同一会话内递增 */
  nextRpcId: number
}

const map = new Map<string, SseHeldEntry>()
const IDLE_TTL_MS = 15 * 60 * 1000

function sortedHeaderEntries(user: Record<string, string>): [string, string][] {
  return Object.entries(user).sort(([a], [b]) => a.localeCompare(b))
}

export function makeSseHeldKey(sseBaseUrl: string, user: Record<string, string>): string {
  return `${sseBaseUrl.trim()}\u0000${JSON.stringify(sortedHeaderEntries(user))}`
}

export function getHeldSse(key: string): SseHeldEntry | null {
  const h = map.get(key)
  if (!h) return null
  if (Date.now() - h.lastUsedAt > IDLE_TTL_MS) {
    disposeHeldSse(key)
    return null
  }
  return h
}

export function putHeldSse(key: string, entry: SseHeldEntry): void {
  const prev = map.get(key)
  if (prev && prev.bridge !== entry.bridge) {
    prev.bridge.dispose()
  }
  map.set(key, entry)
}

export function touchHeldSse(key: string): void {
  const h = map.get(key)
  if (h) h.lastUsedAt = Date.now()
}

export function disposeHeldSse(key: string): void {
  const h = map.get(key)
  if (h) {
    h.bridge.dispose()
    map.delete(key)
  }
}

/** keepKey 为 null 时清空全部；否则只保留该 key */
export function disposeAllHeldSseExcept(keepKey: string | null): void {
  for (const k of [...map.keys()]) {
    if (keepKey != null && k === keepKey) continue
    disposeHeldSse(k)
  }
}
