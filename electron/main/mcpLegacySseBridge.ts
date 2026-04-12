/**
 * HTTP/SSE 远程传输：SSE GET 必须保持打开直至会话结束；
 * 服务端通过 SSE 的 `message` 事件推送 JSON-RPC；仅读 `endpoint` 后关闭连接会导致
 * 「Invalid or expired SSE session」类错误。
 */

const MCP_SESSION_HEADER_LC = 'mcp-session-id'

function omitSessionHeaders(user: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(user)) {
    if (k.trim().toLowerCase() === MCP_SESSION_HEADER_LC) continue
    out[k] = v
  }
  return out
}

function parseEndpointData(data: string, sseBaseUrl: string): string | null {
  const t = data.trim()
  if (!t) return null
  const asHttp = (s: string): string | null => {
    const x = s.trim()
    if (x.startsWith('http://') || x.startsWith('https://')) return x
    try {
      const u = new URL(x, sseBaseUrl)
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.href
    } catch {
      /* 忽略 */
    }
    return null
  }
  try {
    const j = JSON.parse(t) as unknown
    if (typeof j === 'string') {
      const abs = asHttp(j)
      if (abs) return abs
    }
  } catch {
    /* 非 JSON */
  }
  let unquoted = t
  if (unquoted.length >= 2 && unquoted.startsWith('"') && unquoted.endsWith('"')) {
    unquoted = unquoted.slice(1, -1).trim()
  }
  return asHttp(unquoted)
}

type ParsedEvent = { event: string; data: string }

function parseSseFrameBlock(block: string): ParsedEvent | null {
  const lines = block.split(/\r?\n/)
  let eventName = 'message'
  const dataParts: string[] = []
  for (const line of lines) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim()
    else if (line.startsWith('data:')) dataParts.push(line.slice(5).trimStart())
  }
  if (dataParts.length === 0 && !block.trim()) return null
  return { event: eventName, data: dataParts.join('\n') }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function rpcIdKey(id: unknown): string | null {
  if (id === null || id === undefined) return null
  if (typeof id === 'number' && Number.isFinite(id)) return String(id)
  if (typeof id === 'string') return id
  return null
}

type Waiter = { resolve: (v: unknown) => void; reject: (e: Error) => void }

export class LegacySseBridge {
  private readonly sseBaseUrl: string
  private disposed = false
  private buffer = ''
  private endpointResolved = false
  private readonly postUrlResolve: (u: string) => void
  private readonly postUrlReject: (e: Error) => void
  readonly postUrl: Promise<string>
  private readonly pending = new Map<string, Waiter[]>()
  private readonly early = new Map<string, unknown>()

  private constructor(
    private readonly reader: ReadableStreamDefaultReader<Uint8Array>,
    sseBaseUrl: string,
  ) {
    this.sseBaseUrl = sseBaseUrl
    let postUrlResolve!: (u: string) => void
    let postUrlReject!: (e: Error) => void
    this.postUrl = new Promise<string>((resolve, reject) => {
      postUrlResolve = resolve
      postUrlReject = reject
    })
    this.postUrlResolve = postUrlResolve
    this.postUrlReject = postUrlReject
    void this.pump()
  }

  static async connect(
    sseBaseUrl: string,
    userHeaders: Record<string, string>,
    signal: AbortSignal,
  ): Promise<{ ok: true; bridge: LegacySseBridge } | { ok: false; error: string }> {
    const user = omitSessionHeaders(userHeaders)
    const headers = new Headers()
    for (const [k, v] of Object.entries(user)) {
      headers.set(k, v)
    }
    headers.set('Accept', 'text/event-stream')

    let res: Response
    try {
      res = await fetch(sseBaseUrl, { method: 'GET', headers, signal })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false, error: `SSE GET 失败：${message}` }
    }

    if (!res.ok) {
      return { ok: false, error: `SSE GET HTTP ${res.status} ${res.statusText}`.trim() }
    }

    const reader = res.body?.getReader()
    if (!reader) {
      return { ok: false, error: 'SSE 响应无 body' }
    }

    return { ok: true, bridge: new LegacySseBridge(reader, sseBaseUrl) }
  }

  private async pump(): Promise<void> {
    const decoder = new TextDecoder()
    try {
      for (;;) {
        if (this.disposed) break
        const { done, value } = await this.reader.read()
        if (value) this.buffer += decoder.decode(value, { stream: !done })

        const parts = this.buffer.split('\n\n')
        this.buffer = parts.pop() ?? ''

        for (const block of parts) {
          this.processBlock(block)
        }

        if (done) break
      }
    } catch (e) {
      if (!this.disposed && !this.endpointResolved) {
        const message = e instanceof Error ? e.message : String(e)
        this.postUrlReject(new Error(`SSE 读流异常：${message}`))
      }
    } finally {
      if (!this.disposed && !this.endpointResolved) {
        this.postUrlReject(new Error('SSE 在收到 endpoint 事件前结束'))
      }
      try {
        await this.reader.cancel()
      } catch {
        /* 忽略 */
      }
    }
  }

  private processBlock(block: string): void {
    const ev = parseSseFrameBlock(block)
    if (!ev) return
    const en = ev.event.toLowerCase()

    if (en === 'endpoint') {
      if (!this.endpointResolved) {
        const url = parseEndpointData(ev.data, this.sseBaseUrl)
        if (url) {
          this.endpointResolved = true
          this.postUrlResolve(url)
        }
      }
      return
    }

    if (en !== 'message') return

    const trimmed = ev.data.trim()
    if (!trimmed) return
    try {
      const msg = JSON.parse(trimmed) as unknown
      this.dispatchJsonRpc(msg)
    } catch {
      /* 非 JSON */
    }
  }

  private dispatchJsonRpc(msg: unknown): void {
    if (!isRecord(msg) || msg.jsonrpc !== '2.0') return
    const key = rpcIdKey(msg.id)
    if (!key) return

    const waiters = this.pending.get(key)
    if (waiters && waiters.length > 0) {
      const w = waiters.shift()!
      if (waiters.length === 0) this.pending.delete(key)
      w.resolve(msg)
      return
    }

    this.early.set(key, msg)
  }

  waitForJsonRpcMessage(rpcId: number, signal: AbortSignal): Promise<unknown> {
    const key = String(rpcId)

    const earlyHit = this.early.get(key)
    if (earlyHit !== undefined) {
      this.early.delete(key)
      return Promise.resolve(earlyHit)
    }

    return new Promise<unknown>((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error(signal.reason instanceof Error ? signal.reason.message : 'aborted'))
        return
      }

      const waiter: Waiter = { resolve, reject }
      const list = this.pending.get(key) ?? []
      list.push(waiter)
      this.pending.set(key, list)

      const onAbort = () => {
        this.removeWaiter(key, waiter)
        reject(new Error(signal.reason instanceof Error ? signal.reason.message : 'aborted'))
      }
      signal.addEventListener('abort', onAbort, { once: true })
    })
  }

  cancelRpcWait(rpcId: number): void {
    const key = String(rpcId)
    const waiters = this.pending.get(key)
    if (!waiters?.length) return
    for (const w of waiters) {
      w.reject(Object.assign(new Error('cancelled'), { name: 'RpcWaitCancelled' }))
    }
    this.pending.delete(key)
  }

  private removeWaiter(key: string, waiter: Waiter): void {
    const list = this.pending.get(key)
    if (!list) return
    const i = list.indexOf(waiter)
    if (i >= 0) list.splice(i, 1)
    if (list.length === 0) this.pending.delete(key)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const [, waiters] of this.pending) {
      for (const w of waiters) {
        w.reject(Object.assign(new Error('SSE 连接已关闭'), { name: 'SseDisposed' }))
      }
    }
    this.pending.clear()
    this.early.clear()
    void this.reader.cancel().catch(() => {})
  }
}
