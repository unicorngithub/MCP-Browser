import type { CallToolResult, FetchToolsResult, MCPTool } from '../../shared/types'

const CLIENT_NAME = 'mcp-browser'
const CLIENT_VERSION = '0.1.0'

const ACCEPT = 'application/json, text/event-stream'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function normalizeTools(raw: unknown): MCPTool[] {
  if (!isRecord(raw) || !Array.isArray(raw.tools)) return []
  return raw.tools.filter(
    (t): t is MCPTool =>
      isRecord(t) && typeof t.name === 'string',
  ) as MCPTool[]
}

function parseSseDataJsonObjects(raw: string): unknown[] {
  const out: unknown[] = []
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t.startsWith('data:')) continue
    const payload = t.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      out.push(JSON.parse(payload) as unknown)
    } catch {
      /* 忽略非 JSON 的 data 行 */
    }
  }
  return out
}

function extractJsonRpcMessages(contentType: string, raw: string): unknown[] {
  const ct = contentType.toLowerCase()
  const looksSse =
    ct.includes('text/event-stream') ||
    (/^id:|^event:|^data:/m.test(raw.trimStart()) && raw.includes('data:'))
  if (looksSse) return parseSseDataJsonObjects(raw)
  try {
    const j = JSON.parse(raw) as unknown
    return Array.isArray(j) ? j : [j]
  } catch {
    return []
  }
}

function rpcIdMatches(msgId: unknown, expectedId: number): boolean {
  if (msgId === expectedId) return true
  if (typeof msgId === 'string' && Number(msgId) === expectedId) return true
  return false
}

function pickByRpcId(
  messages: unknown[],
  expectedId: number,
): { result?: unknown; error?: { message: string; code?: number } } | null {
  for (const m of messages) {
    if (!isRecord(m) || m.jsonrpc !== '2.0') continue
    if (m.id == null || !rpcIdMatches(m.id, expectedId)) continue
    if (m.error != null && isRecord(m.error) && typeof m.error.message === 'string') {
      return {
        error: {
          message: m.error.message,
          code: typeof m.error.code === 'number' ? m.error.code : undefined,
        },
      }
    }
    if ('result' in m) return { result: m.result }
  }
  return null
}

function getSessionId(res: Response): string | null {
  return res.headers.get('mcp-session-id') || res.headers.get('Mcp-Session-Id')
}

async function mcpPost(
  href: string,
  body: unknown,
  sessionId: string | null,
  signal: AbortSignal,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: ACCEPT,
  }
  if (sessionId) headers['Mcp-Session-Id'] = sessionId
  return fetch(href, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })
}

async function sendInitializedNotification(
  href: string,
  sessionId: string | null,
  signal: AbortSignal,
): Promise<void> {
  const res = await mcpPost(
    href,
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    sessionId,
    signal,
  )
  if (res.status === 202) return
  if (res.ok && (res.status === 200 || res.status === 204)) return
  const t = await res.text()
  throw new Error(`notifications/initialized 失败 HTTP ${res.status}：${t.slice(0, 300)}`)
}

async function readRpcResult(
  res: Response,
  rpcId: number,
): Promise<{ result?: unknown; error?: { message: string; code?: number }; httpError?: string }> {
  const raw = await res.text()
  const ct = res.headers.get('content-type') ?? ''
  const messages = extractJsonRpcMessages(ct, raw)
  const picked = pickByRpcId(messages, rpcId)
  if (picked?.error) return { error: picked.error }
  if (picked?.result !== undefined) return { result: picked.result }
  if (!res.ok) {
    return {
      httpError: `HTTP ${res.status}：${raw.slice(0, 400)}`,
    }
  }
  return {
    httpError: `无法解析 JSON-RPC 响应（id=${rpcId}）：${raw.slice(0, 400)}`,
  }
}

function shouldRetryInitializeWithOlderProtocol(errMsg: string, code?: number): boolean {
  if (code === -32602) return true
  const lower = errMsg.toLowerCase()
  return (
    lower.includes('protocol') ||
    lower.includes('version') ||
    lower.includes('unsupported')
  )
}

function parseMcpEndpoint(endpoint: string): { ok: true; href: string } | { ok: false; error: string } {
  const trimmed = endpoint.trim()
  if (!trimmed) return { ok: false, error: '地址为空' }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, error: 'URL 格式无效' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: '仅支持 http / https' }
  }
  return { ok: true, href: url.href }
}

function closeMcpSession(href: string, sessionToClose: string | null): void {
  if (!sessionToClose) return
  void fetch(href, {
    method: 'DELETE',
    headers: {
      Accept: ACCEPT,
      'Mcp-Session-Id': sessionToClose,
    },
    signal: AbortSignal.timeout(8000),
  }).catch(() => {})
}

type OpenSessionOk = {
  href: string
  sessionId: string | null
  signal: AbortSignal
  sessionToClose: string | null
}

async function openMcpSession(href: string): Promise<
  { ok: true } & OpenSessionOk | { ok: false; error: string }
> {
  const signal = AbortSignal.timeout(60_000)
  let sessionId: string | null = null
  let sessionToClose: string | null = null
  let initialized = false

  const protocolCandidates = ['2025-03-26', '2024-11-05'] as const

  for (let i = 0; i < protocolCandidates.length; i++) {
    const protocolVersion = protocolCandidates[i]
    const initRes = await mcpPost(
      href,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion,
          capabilities: {},
          clientInfo: { name: CLIENT_NAME, version: CLIENT_VERSION },
        },
      },
      null,
      signal,
    )

    const sid = getSessionId(initRes)
    const initRead = await readRpcResult(initRes, 1)

    if (initRead.error) {
      const retry =
        i < protocolCandidates.length - 1 &&
        shouldRetryInitializeWithOlderProtocol(initRead.error.message, initRead.error.code)
      if (retry) continue
      return {
        ok: false,
        error: `initialize 失败：${initRead.error.message}`,
      }
    }

    if (initRead.httpError && !initRead.result) {
      return { ok: false, error: initRead.httpError }
    }

    sessionId = sid
    sessionToClose = sid
    initialized = true
    break
  }

  if (!initialized) {
    return { ok: false, error: 'initialize 未成功' }
  }

  try {
    await sendInitializedNotification(href, sessionId, signal)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: message }
  }

  return { ok: true, href, sessionId, signal, sessionToClose }
}

export async function fetchMcpToolsList(endpoint: string): Promise<FetchToolsResult> {
  const parsed = parseMcpEndpoint(endpoint)
  if (!parsed.ok) return parsed

  const session = await openMcpSession(parsed.href)
  if (!session.ok) return session

  const { href, sessionId, signal, sessionToClose } = session

  try {
    const listRes = await mcpPost(
      href,
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      sessionId,
      signal,
    )

    const listRead = await readRpcResult(listRes, 2)
    if (listRead.error) {
      return { ok: false, error: `tools/list 失败：${listRead.error.message}` }
    }
    if (listRead.httpError && listRead.result === undefined) {
      return { ok: false, error: listRead.httpError }
    }

    const tools = normalizeTools(listRead.result)
    return { ok: true, tools }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: message }
  } finally {
    closeMcpSession(href, sessionToClose)
  }
}

export async function callMcpTool(
  endpoint: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const parsed = parseMcpEndpoint(endpoint)
  if (!parsed.ok) return parsed

  const name = toolName.trim()
  if (!name) return { ok: false, error: '工具名称为空' }

  const session = await openMcpSession(parsed.href)
  if (!session.ok) return session

  const { href, sessionId, signal, sessionToClose } = session

  try {
    const callRes = await mcpPost(
      href,
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name, arguments: args },
      },
      sessionId,
      signal,
    )

    const callRead = await readRpcResult(callRes, 3)
    if (callRead.error) {
      return { ok: false, error: `tools/call 失败：${callRead.error.message}` }
    }
    if (callRead.httpError && callRead.result === undefined) {
      return { ok: false, error: callRead.httpError }
    }
    return { ok: true, result: callRead.result }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: message }
  } finally {
    closeMcpSession(href, sessionToClose)
  }
}
