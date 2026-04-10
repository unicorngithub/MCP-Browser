/** 按 endpoint + 请求头区分；成功操作后刷新 lastUsedAt，超时则丢弃 */
const SESSION_IDLE_TTL_MS = 15 * 60 * 1000

export type CachedMcpSession = {
  href: string
  sessionId: string | null
  userHeaders: Record<string, string>
  lastUsedAt: number
}

const cache = new Map<string, CachedMcpSession>()

/** 单 endpoint 上并发的「建连」合并为一次 openMcpSession */
const opening = new Map<string, Promise<unknown>>()

export function makeMcpSessionCacheKey(href: string, userHeaders: Record<string, string>): string {
  const entries = Object.entries(userHeaders).sort(([a], [b]) => a.localeCompare(b))
  return `${href}\u0000${JSON.stringify(entries)}`
}

export function getValidCachedSession(key: string): CachedMcpSession | null {
  const row = cache.get(key)
  if (!row) return null
  if (Date.now() - row.lastUsedAt > SESSION_IDLE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return row
}

export function touchCachedSession(key: string): void {
  const row = cache.get(key)
  if (row) row.lastUsedAt = Date.now()
}

export function putCachedSession(key: string, row: Omit<CachedMcpSession, 'lastUsedAt'>): void {
  cache.set(key, { ...row, lastUsedAt: Date.now() })
}

export function invalidateMcpSessionCacheKey(key: string): void {
  cache.delete(key)
}

export function invalidateAllMcpSessionCache(): void {
  cache.clear()
}

/**
 * 同一 key 上多个协程同时 miss 缓存时，只执行一次 opener，其余 await 同一 Promise。
 */
export async function runExclusiveSessionOpen<T>(key: string, opener: () => Promise<T>): Promise<T> {
  const existing = opening.get(key) as Promise<T> | undefined
  if (existing) return existing

  const p = Promise.resolve()
    .then(() => opener())
    .finally(() => {
      if (opening.get(key) === p) opening.delete(key)
    })

  opening.set(key, p)
  return p
}
