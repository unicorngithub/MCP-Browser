import { app } from 'electron'
import {
  getValidCachedSession,
  invalidateMcpSessionCacheKey,
  makeMcpSessionCacheKey,
  putCachedSession,
  runExclusiveSessionOpen,
  touchCachedSession,
} from './mcpSessionCache'
import type {
  CallToolResult,
  FetchToolsResult,
  MCPHttpHeader,
  MCPTool,
  McpConnectDiagnostics,
  McpConnectStep,
  McpToolCallHttpTrace,
} from '../../shared/types'

const CLIENT_NAME = 'mcp-browser'

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

/** 将配置的 header 列表转为 fetch 用的字典（忽略空名称） */
export function mcpHeadersToRecord(rows: MCPHttpHeader[] | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!rows?.length) return out
  for (const { name, value } of rows) {
    const n = typeof name === 'string' ? name.trim() : ''
    if (!n) continue
    out[n] = typeof value === 'string' ? value : String(value)
  }
  return out
}

function mergePostHeaders(
  user: Record<string, string>,
  sessionId: string | null,
): Record<string, string> {
  const h: Record<string, string> = { ...user }
  h['Content-Type'] = 'application/json'
  h.Accept = ACCEPT
  if (sessionId) h['Mcp-Session-Id'] = sessionId
  return h
}

function mergeDeleteHeaders(user: Record<string, string>, sessionToClose: string): Record<string, string> {
  const h: Record<string, string> = { ...user }
  h.Accept = ACCEPT
  h['Mcp-Session-Id'] = sessionToClose
  return h
}

async function mcpPost(
  href: string,
  body: unknown,
  sessionId: string | null,
  signal: AbortSignal,
  userHeaders: Record<string, string>,
): Promise<Response> {
  return fetch(href, {
    method: 'POST',
    headers: mergePostHeaders(userHeaders, sessionId),
    body: JSON.stringify(body),
    signal,
  })
}

async function sendInitializedNotification(
  href: string,
  sessionId: string | null,
  signal: AbortSignal,
  userHeaders: Record<string, string>,
): Promise<{ ok: true } | { ok: false; status: number; detail: string }> {
  const res = await mcpPost(
    href,
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    sessionId,
    signal,
    userHeaders,
  )
  if (res.status === 202) return { ok: true }
  if (res.ok && (res.status === 200 || res.status === 204)) return { ok: true }
  const t = await res.text()
  return { ok: false, status: res.status, detail: t.slice(0, 300) }
}

function sortHeaderLinesFromRecord(h: Record<string, string>): string {
  return Object.entries(h)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'accent' }))
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}

function sortHeaderLinesFromFetchHeaders(headers: Headers): string {
  return [...headers.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'accent' }))
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}

function parseRpcFromRaw(
  status: number,
  contentType: string,
  raw: string,
  rpcId: number,
  httpOk: boolean,
): {
  status: number
  result?: unknown
  error?: { message: string; code?: number }
  httpError?: string
} {
  const messages = extractJsonRpcMessages(contentType, raw)
  const picked = pickByRpcId(messages, rpcId)
  if (picked?.error) return { status, error: picked.error }
  if (picked?.result !== undefined) return { status, result: picked.result }
  if (!httpOk) {
    return {
      status,
      httpError: `HTTP ${status}：${raw.slice(0, 400)}`,
    }
  }
  return {
    status,
    httpError: `无法解析 JSON-RPC 响应（id=${rpcId}）：${raw.slice(0, 400)}`,
  }
}

async function readRpcResult(
  res: Response,
  rpcId: number,
): Promise<{
  status: number
  result?: unknown
  error?: { message: string; code?: number }
  httpError?: string
}> {
  const status = res.status
  const raw = await res.text()
  const ct = res.headers.get('content-type') ?? ''
  return parseRpcFromRaw(status, ct, raw, rpcId, res.ok)
}

function connDiag(
  step: McpConnectStep,
  httpStatus: number | null,
  hadSessionId: boolean,
  detail: string,
): McpConnectDiagnostics {
  return { step, httpStatus, hadSessionId, detail }
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

function closeMcpSession(
  href: string,
  sessionToClose: string | null,
  userHeaders: Record<string, string>,
): void {
  if (!sessionToClose) return
  void fetch(href, {
    method: 'DELETE',
    headers: mergeDeleteHeaders(userHeaders, sessionToClose),
    signal: AbortSignal.timeout(8000),
  }).catch(() => {})
}

type OpenSessionOk = {
  href: string
  sessionId: string | null
  signal: AbortSignal
  sessionToClose: string | null
}

type OpenSessionFail = { ok: false; error: string; diagnostics: McpConnectDiagnostics }

async function openMcpSession(
  href: string,
  userHeaders: Record<string, string>,
): Promise<({ ok: true } & OpenSessionOk) | OpenSessionFail> {
  const signal = AbortSignal.timeout(60_000)
  let sessionId: string | null = null
  let sessionToClose: string | null = null
  let initialized = false

  const protocolCandidates = ['2025-03-26', '2024-11-05'] as const

  for (let i = 0; i < protocolCandidates.length; i++) {
    const protocolVersion = protocolCandidates[i]
    let initRes: Response
    try {
      initRes = await mcpPost(
        href,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion,
            capabilities: {},
            clientInfo: { name: CLIENT_NAME, version: app.getVersion() },
          },
        },
        null,
        signal,
        userHeaders,
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: message,
        diagnostics: connDiag('initialize', null, false, message),
      }
    }

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
        diagnostics: connDiag('initialize', initRead.status, !!sid, initRead.error.message),
      }
    }

    if (initRead.httpError && !initRead.result) {
      return {
        ok: false,
        error: initRead.httpError,
        diagnostics: connDiag('initialize', initRead.status, !!sid, initRead.httpError),
      }
    }

    sessionId = sid
    sessionToClose = sid
    initialized = true
    break
  }

  if (!initialized) {
    return {
      ok: false,
      error: 'initialize 未成功',
      diagnostics: connDiag(
        'initialize',
        null,
        false,
        '协议版本重试后仍未获得有效 initialize 结果',
      ),
    }
  }

  const notif = await sendInitializedNotification(href, sessionId, signal, userHeaders)
  if (!notif.ok) {
    const hadSid = !!(sessionId && sessionId.length > 0)
    return {
      ok: false,
      error: `notifications/initialized 失败 HTTP ${notif.status}：${notif.detail}`,
      diagnostics: connDiag('notifications/initialized', notif.status, hadSid, notif.detail),
    }
  }

  return { ok: true, href, sessionId, signal, sessionToClose }
}

type AcquiredSession =
  | { ok: true; href: string; sessionId: string | null; cacheKey: string }
  | { ok: false; error: string; diagnostics: McpConnectDiagnostics }

async function acquireSession(
  href: string,
  userHeaders: Record<string, string>,
  reuseSession: boolean,
): Promise<AcquiredSession> {
  const cacheKey = makeMcpSessionCacheKey(href, userHeaders)

  if (!reuseSession) {
    invalidateMcpSessionCacheKey(cacheKey)
    const r = await openMcpSession(href, userHeaders)
    if (!r.ok) return r
    return { ok: true, href: r.href, sessionId: r.sessionId, cacheKey }
  }

  const hit = getValidCachedSession(cacheKey)
  if (hit) {
    touchCachedSession(cacheKey)
    return { ok: true, href: hit.href, sessionId: hit.sessionId, cacheKey }
  }

  const r = await runExclusiveSessionOpen(cacheKey, async () => {
    const opened = await openMcpSession(href, userHeaders)
    if (opened.ok) {
      putCachedSession(cacheKey, {
        href: opened.href,
        sessionId: opened.sessionId,
        userHeaders: { ...userHeaders },
      })
    }
    return opened
  })

  if (!r.ok) return r
  return { ok: true, href: r.href, sessionId: r.sessionId, cacheKey }
}

export async function fetchMcpToolsList(
  endpoint: string,
  extraHeaders?: MCPHttpHeader[],
  reuseSession = false,
): Promise<FetchToolsResult> {
  const parsed = parseMcpEndpoint(endpoint)
  if (!parsed.ok) return parsed

  const userHeaders = mcpHeadersToRecord(extraHeaders)

  const session = await acquireSession(parsed.href, userHeaders, reuseSession)
  if (!session.ok) return { ok: false, error: session.error, diagnostics: session.diagnostics }

  const { href, sessionId, cacheKey } = session
  const hadSidForList = !!(sessionId && sessionId.length > 0)
  const opSignal = AbortSignal.timeout(60_000)

  try {
    let listRes: Response
    try {
      listRes = await mcpPost(
        href,
        { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
        sessionId,
        opSignal,
        userHeaders,
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (reuseSession) invalidateMcpSessionCacheKey(cacheKey)
      return {
        ok: false,
        error: message,
        diagnostics: connDiag('tools/list', null, hadSidForList, message),
      }
    }

    const listRead = await readRpcResult(listRes, 2)
    if (listRead.error) {
      if (reuseSession) invalidateMcpSessionCacheKey(cacheKey)
      return {
        ok: false,
        error: `tools/list 失败：${listRead.error.message}`,
        diagnostics: connDiag('tools/list', listRead.status, hadSidForList, listRead.error.message),
      }
    }
    if (listRead.httpError && listRead.result === undefined) {
      if (reuseSession) invalidateMcpSessionCacheKey(cacheKey)
      return {
        ok: false,
        error: listRead.httpError,
        diagnostics: connDiag('tools/list', listRead.status, hadSidForList, listRead.httpError),
      }
    }

    const tools = normalizeTools(listRead.result)
    if (reuseSession) touchCachedSession(cacheKey)
    return { ok: true, tools }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (reuseSession) invalidateMcpSessionCacheKey(cacheKey)
    return {
      ok: false,
      error: message,
      diagnostics: connDiag('tools/list', null, hadSidForList, message),
    }
  } finally {
    if (!reuseSession) {
      closeMcpSession(href, sessionId, userHeaders)
      invalidateMcpSessionCacheKey(cacheKey)
    }
  }
}

export async function callMcpTool(
  endpoint: string,
  toolName: string,
  args: Record<string, unknown>,
  extraHeaders?: MCPHttpHeader[],
  reuseSession = false,
): Promise<CallToolResult> {
  const parsed = parseMcpEndpoint(endpoint)
  if (!parsed.ok) return parsed

  const name = toolName.trim()
  if (!name) return { ok: false, error: '工具名称为空' }

  const userHeaders = mcpHeadersToRecord(extraHeaders)

  const session = await acquireSession(parsed.href, userHeaders, reuseSession)
  if (!session.ok) return { ok: false, error: session.error, diagnostics: session.diagnostics }

  const { href, sessionId, cacheKey } = session
  const hadSidForCall = !!(sessionId && sessionId.length > 0)
  const opSignal = AbortSignal.timeout(60_000)

  const TOOLS_CALL_RPC_ID = 3

  try {
    const mergedHeaders = mergePostHeaders(userHeaders, sessionId)
    const bodyObj = {
      jsonrpc: '2.0' as const,
      id: TOOLS_CALL_RPC_ID,
      method: 'tools/call' as const,
      params: { name, arguments: args },
    }
    const bodyStr = JSON.stringify(bodyObj)
    const reqTrace: McpToolCallHttpTrace['request'] = {
      method: 'POST',
      url: href,
      headersText: sortHeaderLinesFromRecord(mergedHeaders),
      body: bodyStr,
    }

    let callRes: Response
    try {
      callRes = await fetch(href, {
        method: 'POST',
        headers: mergedHeaders,
        body: bodyStr,
        signal: opSignal,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (reuseSession) invalidateMcpSessionCacheKey(cacheKey)
      return {
        ok: false,
        error: message,
        diagnostics: connDiag('tools/call', null, hadSidForCall, message),
        httpTrace: { request: reqTrace, response: null },
      }
    }

    const responseText = await callRes.text()
    const ct = callRes.headers.get('content-type') ?? ''
    const httpTrace: McpToolCallHttpTrace = {
      request: reqTrace,
      response: {
        status: callRes.status,
        statusText: callRes.statusText,
        headersText: sortHeaderLinesFromFetchHeaders(callRes.headers),
        body: responseText,
      },
    }

    const callRead = parseRpcFromRaw(callRes.status, ct, responseText, TOOLS_CALL_RPC_ID, callRes.ok)
    if (callRead.error) {
      if (reuseSession) invalidateMcpSessionCacheKey(cacheKey)
      return {
        ok: false,
        error: `tools/call 失败：${callRead.error.message}`,
        diagnostics: connDiag('tools/call', callRead.status, hadSidForCall, callRead.error.message),
        httpTrace,
      }
    }
    if (callRead.httpError && callRead.result === undefined) {
      if (reuseSession) invalidateMcpSessionCacheKey(cacheKey)
      return {
        ok: false,
        error: callRead.httpError,
        diagnostics: connDiag('tools/call', callRead.status, hadSidForCall, callRead.httpError),
        httpTrace,
      }
    }
    if (reuseSession) touchCachedSession(cacheKey)
    return { ok: true, result: callRead.result, httpTrace }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (reuseSession) invalidateMcpSessionCacheKey(cacheKey)
    return {
      ok: false,
      error: message,
      diagnostics: connDiag('tools/call', null, hadSidForCall, message),
    }
  } finally {
    if (!reuseSession) {
      closeMcpSession(href, sessionId, userHeaders)
      invalidateMcpSessionCacheKey(cacheKey)
    }
  }
}
