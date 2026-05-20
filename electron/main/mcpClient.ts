import { app } from 'electron'
import {
  getValidCachedSession,
  invalidateMcpSessionCacheKey,
  makeMcpSessionCacheKey,
  putCachedSession,
  runExclusiveSessionOpen,
  touchCachedSession,
} from './mcpSessionCache'
import {
  type McpHeaderValidationFailure,
  mcpHeaderValidationFailureName,
  mcpHeaderValidationFailureValue,
} from '../../shared/mcpHeaderValidationMessages'
import type {
  CallToolResult,
  FetchToolsResult,
  MCPHttpHeader,
  MCPTool,
  McpConnectDiagnostics,
  McpConnectStep,
  McpErrorI18n,
  McpHttpTransport,
  McpToolCallHttpTrace,
} from '../../shared/types'
import { LegacySseBridge } from './mcpLegacySseBridge'
import {
  disposeAllHeldSseExcept,
  disposeHeldSse,
  getHeldSse,
  makeSseHeldKey,
  putHeldSse,
  touchHeldSse,
  type SseHeldEntry,
} from './mcpSseHeldSession'

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

/**
 * Chromium fetch 要求 Headers 的 name/value 为 ByteString（每码元 ≤255）。
 * 含中文等会同步抛错，且不会出现 HTTP 响应。
 */
function isHeaderByteStringCompatible(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 255) return false
  }
  return true
}

export function validateMcpExtraHeadersForFetch(
  rows: MCPHttpHeader[] | undefined,
): McpHeaderValidationFailure | null {
  if (!rows?.length) return null
  for (let idx = 0; idx < rows.length; idx++) {
    const { name, value } = rows[idx]
    const n = typeof name === 'string' ? name.trim() : ''
    if (!n) continue
    const v = typeof value === 'string' ? value : String(value)
    if (!isHeaderByteStringCompatible(n)) {
      return mcpHeaderValidationFailureName(idx + 1)
    }
    if (!isHeaderByteStringCompatible(v)) {
      return mcpHeaderValidationFailureValue(n)
    }
  }
  return null
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

/** Streamable HTTP：响应在 POST body；HTTP/SSE 可能在 POST 空/202 后由 SSE `message` 事件送达 */
async function postMcpRpcReadResult(
  legacySse: LegacySseBridge | null,
  href: string,
  body: unknown,
  rpcId: number,
  sessionId: string | null,
  signal: AbortSignal,
  userHeaders: Record<string, string>,
): Promise<{
  raw: string
  status: number
  sessionHeader: string | null
  result?: unknown
  error?: { message: string; code?: number }
  httpError?: string
}> {
  const sseWait = legacySse ? legacySse.waitForJsonRpcMessage(rpcId, signal) : null

  let initRes: Response
  try {
    initRes = await mcpPost(href, body, sessionId, signal, userHeaders)
  } catch (e) {
    if (legacySse) legacySse.cancelRpcWait(rpcId)
    throw e
  }

  const sessionHeader = getSessionId(initRes)
  const raw = await initRes.text()
  const ct = initRes.headers.get('content-type') ?? ''
  const parsed = parseRpcFromRaw(initRes.status, ct, raw, rpcId, initRes.ok)
  const { status: _parsedStatus, ...parsedRest } = parsed

  if (parsed.result !== undefined || parsed.error) {
    if (legacySse) legacySse.cancelRpcWait(rpcId)
    return { raw, status: initRes.status, sessionHeader, ...parsedRest }
  }

  if (!initRes.ok) {
    if (legacySse) legacySse.cancelRpcWait(rpcId)
    return { raw, status: initRes.status, sessionHeader, ...parsedRest }
  }

  if (!legacySse || !sseWait) {
    return { raw, status: initRes.status, sessionHeader, ...parsedRest }
  }

  try {
    const msg = await sseWait
    const msgStr =
      typeof msg === 'object' && msg !== null ? JSON.stringify(msg as object) : String(msg)
    const fromSse = parseRpcFromRaw(200, 'application/json', msgStr, rpcId, true)
    const { status: _s, ...fromSseRest } = fromSse
    return {
      raw: raw.trim() ? `${raw}\n---sse---\n${msgStr}` : msgStr,
      status: initRes.status,
      sessionHeader,
      ...fromSseRest,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      raw,
      status: initRes.status,
      sessionHeader,
      httpError: `等待 SSE 上的 JSON-RPC 响应失败（id=${rpcId}）：${message}`,
    }
  }
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

function makePostRequestTrace(
  href: string,
  userHeaders: Record<string, string>,
  sessionId: string | null,
  body: unknown,
): McpToolCallHttpTrace['request'] {
  const merged = mergePostHeaders(userHeaders, sessionId)
  return {
    method: 'POST',
    url: href,
    headersText: sortHeaderLinesFromRecord(merged),
    body: JSON.stringify(body),
  }
}

function makeResponseTrace(res: Response, rawBody: string): McpToolCallHttpTrace['response'] {
  return {
    status: res.status,
    statusText: res.statusText,
    headersText: sortHeaderLinesFromFetchHeaders(res.headers),
    body: rawBody,
  }
}

const INITIALIZED_NOTIFICATION_BODY = {
  jsonrpc: '2.0' as const,
  method: 'notifications/initialized' as const,
}

async function sendInitializedNotification(
  href: string,
  sessionId: string | null,
  signal: AbortSignal,
  userHeaders: Record<string, string>,
): Promise<
  | { ok: true }
  | { ok: false; status: number; detail: string; httpTrace: McpToolCallHttpTrace }
> {
  const reqTrace = makePostRequestTrace(href, userHeaders, sessionId, INITIALIZED_NOTIFICATION_BODY)
  const res = await mcpPost(href, INITIALIZED_NOTIFICATION_BODY, sessionId, signal, userHeaders)
  if (res.status === 202) return { ok: true }
  if (res.ok && (res.status === 200 || res.status === 204)) return { ok: true }
  const t = await res.text()
  return {
    ok: false,
    status: res.status,
    detail: t.slice(0, 300),
    httpTrace: {
      request: reqTrace,
      response: makeResponseTrace(res, t),
    },
  }
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
  /** 原始响应体，供失败时 HTTP 追踪展示 */
  raw: string
  status: number
  result?: unknown
  error?: { message: string; code?: number }
  httpError?: string
}> {
  const raw = await res.text()
  const ct = res.headers.get('content-type') ?? ''
  const parsed = parseRpcFromRaw(res.status, ct, raw, rpcId, res.ok)
  return { raw, ...parsed }
}

function connDiag(
  step: McpConnectStep,
  httpStatus: number | null,
  hadSessionId: boolean,
  detail: string,
  detailI18n?: McpErrorI18n,
): McpConnectDiagnostics {
  return detailI18n
    ? { step, httpStatus, hadSessionId, detail, detailI18n }
    : { step, httpStatus, hadSessionId, detail }
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

async function prepareMcpPostTransport(
  normalizedHref: string,
  transport: McpHttpTransport,
  userHeaders: Record<string, string>,
  signal: AbortSignal,
): Promise<
  { ok: true; href: string; legacySse: LegacySseBridge | null } | { ok: false; error: string }
> {
  if (transport === 'streamable-http') {
    return { ok: true, href: normalizedHref, legacySse: null }
  }
  const conn = await LegacySseBridge.connect(normalizedHref, userHeaders, signal)
  if (!conn.ok) return conn
  const bridge = conn.bridge
  try {
    const href = await bridge.postUrl
    return { ok: true, href, legacySse: bridge }
  } catch (e) {
    bridge.dispose()
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: message }
  }
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

type OpenSessionFail = {
  ok: false
  error: string
  diagnostics: McpConnectDiagnostics
  httpTrace?: McpToolCallHttpTrace
}

async function openMcpSession(
  href: string,
  userHeaders: Record<string, string>,
  legacySse: LegacySseBridge | null,
): Promise<({ ok: true } & OpenSessionOk) | OpenSessionFail> {
  const signal = AbortSignal.timeout(60_000)
  let sessionId: string | null = null
  let sessionToClose: string | null = null
  let initialized = false

  const protocolCandidates = ['2025-03-26', '2024-11-05'] as const

  for (let i = 0; i < protocolCandidates.length; i++) {
    const protocolVersion = protocolCandidates[i]
    const initPayload = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'initialize' as const,
      params: {
        protocolVersion,
        capabilities: {},
        clientInfo: { name: CLIENT_NAME, version: app.getVersion() },
      },
    }
    const initReqTrace = makePostRequestTrace(href, userHeaders, null, initPayload)
    let initRead: Awaited<ReturnType<typeof postMcpRpcReadResult>>
    try {
      initRead = await postMcpRpcReadResult(
        legacySse,
        href,
        initPayload,
        1,
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
        httpTrace: { request: initReqTrace, response: null },
      }
    }

    const sid = initRead.sessionHeader

    if (initRead.error) {
      const retry =
        i < protocolCandidates.length - 1 &&
        shouldRetryInitializeWithOlderProtocol(initRead.error.message, initRead.error.code)
      if (retry) continue
      return {
        ok: false,
        error: `initialize 失败：${initRead.error.message}`,
        diagnostics: connDiag('initialize', initRead.status, !!sid, initRead.error.message),
        httpTrace: {
          request: initReqTrace,
          response: {
            status: initRead.status,
            statusText: '',
            headersText: '',
            body: initRead.raw,
          },
        },
      }
    }

    if (initRead.httpError && initRead.result === undefined) {
      return {
        ok: false,
        error: initRead.httpError,
        diagnostics: connDiag('initialize', initRead.status, !!sid, initRead.httpError),
        httpTrace: {
          request: initReqTrace,
          response: {
            status: initRead.status,
            statusText: '',
            headersText: '',
            body: initRead.raw,
          },
        },
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
      httpTrace: notif.httpTrace,
    }
  }

  return { ok: true, href, sessionId, signal, sessionToClose }
}

type AcquiredSession =
  | { ok: true; href: string; sessionId: string | null; cacheKey: string }
  | { ok: false; error: string; diagnostics: McpConnectDiagnostics; httpTrace?: McpToolCallHttpTrace }

async function acquireSession(
  href: string,
  userHeaders: Record<string, string>,
  reuseSession: boolean,
  legacySse: LegacySseBridge | null,
): Promise<AcquiredSession> {
  const effectiveReuse = legacySse ? false : reuseSession
  const cacheKey = makeMcpSessionCacheKey(href, userHeaders)

  if (!effectiveReuse) {
    invalidateMcpSessionCacheKey(cacheKey)
    const r = await openMcpSession(href, userHeaders, legacySse)
    if (!r.ok) return r
    return { ok: true, href: r.href, sessionId: r.sessionId, cacheKey }
  }

  const hit = getValidCachedSession(cacheKey)
  if (hit) {
    touchCachedSession(cacheKey)
    return { ok: true, href: hit.href, sessionId: hit.sessionId, cacheKey }
  }

  const r = await runExclusiveSessionOpen(cacheKey, async () => {
    const opened = await openMcpSession(href, userHeaders, legacySse)
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

async function attemptSseToolsListWithHeld(
  held: SseHeldEntry,
  sseKey: string,
  userHeaders: Record<string, string>,
  opSignal: AbortSignal,
): Promise<FetchToolsResult | 'retry'> {
  const hadSidForList = !!(held.sessionId && held.sessionId.length > 0)
  const listId = held.nextRpcId++
  const listPayload = {
    jsonrpc: '2.0' as const,
    id: listId,
    method: 'tools/list' as const,
    params: {},
  }
  const listReqTrace = makePostRequestTrace(held.postHref, userHeaders, held.sessionId, listPayload)
  try {
    const listRead = await postMcpRpcReadResult(
      held.bridge,
      held.postHref,
      listPayload,
      listId,
      held.sessionId,
      opSignal,
      userHeaders,
    )
    if (listRead.error) {
      disposeHeldSse(sseKey)
      return {
        ok: false,
        error: `tools/list 失败：${listRead.error.message}`,
        diagnostics: connDiag('tools/list', listRead.status, hadSidForList, listRead.error.message),
        httpTrace: {
          request: listReqTrace,
          response: {
            status: listRead.status,
            statusText: '',
            headersText: '',
            body: listRead.raw,
          },
        },
      }
    }
    if (listRead.httpError && listRead.result === undefined) {
      disposeHeldSse(sseKey)
      return {
        ok: false,
        error: listRead.httpError,
        diagnostics: connDiag('tools/list', listRead.status, hadSidForList, listRead.httpError),
        httpTrace: {
          request: listReqTrace,
          response: {
            status: listRead.status,
            statusText: '',
            headersText: '',
            body: listRead.raw,
          },
        },
      }
    }
    const sid = listRead.sessionHeader
    if (sid) held.sessionId = sid
    touchHeldSse(sseKey)
    return {
      ok: true,
      tools: normalizeTools(listRead.result),
      sseHeld: true,
      httpTrace: {
        request: listReqTrace,
        response: {
          status: listRead.status,
          statusText: '',
          headersText: '',
          body: listRead.raw,
        },
      },
    }
  } catch {
    disposeHeldSse(sseKey)
    return 'retry'
  }
}

async function fetchMcpToolsListSse(
  sseBaseUrl: string,
  userHeaders: Record<string, string>,
): Promise<FetchToolsResult> {
  const sseKey = makeSseHeldKey(sseBaseUrl, userHeaders)
  disposeAllHeldSseExcept(sseKey)

  const opSignal = AbortSignal.timeout(60_000)

  const heldExisting = getHeldSse(sseKey)
  if (heldExisting) {
    const r = await attemptSseToolsListWithHeld(heldExisting, sseKey, userHeaders, opSignal)
    if (r !== 'retry') return r
  }

  let legacySse: LegacySseBridge | null = null
  try {
    const prepared = await prepareMcpPostTransport(sseBaseUrl, 'sse', userHeaders, opSignal)
    if (!prepared.ok) {
      return {
        ok: false,
        error: prepared.error,
        diagnostics: connDiag('headers', null, false, prepared.error),
      }
    }

    legacySse = prepared.legacySse!
    const postHref = prepared.href

    const session = await acquireSession(postHref, userHeaders, false, legacySse)
    if (!session.ok) {
      legacySse.dispose()
      legacySse = null
      return {
        ok: false,
        error: session.error,
        diagnostics: session.diagnostics,
        httpTrace: session.httpTrace,
      }
    }

    const { href, sessionId } = session
    const hadSidForList = !!(sessionId && sessionId.length > 0)

    const listPayload = {
      jsonrpc: '2.0' as const,
      id: 2,
      method: 'tools/list' as const,
      params: {},
    }
    const listReqTrace = makePostRequestTrace(href, userHeaders, sessionId, listPayload)

    let listRead: Awaited<ReturnType<typeof postMcpRpcReadResult>>
    try {
      listRead = await postMcpRpcReadResult(
        legacySse,
        href,
        listPayload,
        2,
        sessionId,
        opSignal,
        userHeaders,
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      closeMcpSession(href, sessionId, userHeaders)
      return {
        ok: false,
        error: message,
        diagnostics: connDiag('tools/list', null, hadSidForList, message),
        httpTrace: { request: listReqTrace, response: null },
      }
    }

    if (listRead.error) {
      closeMcpSession(href, sessionId, userHeaders)
      return {
        ok: false,
        error: `tools/list 失败：${listRead.error.message}`,
        diagnostics: connDiag('tools/list', listRead.status, hadSidForList, listRead.error.message),
        httpTrace: {
          request: listReqTrace,
          response: {
            status: listRead.status,
            statusText: '',
            headersText: '',
            body: listRead.raw,
          },
        },
      }
    }
    if (listRead.httpError && listRead.result === undefined) {
      closeMcpSession(href, sessionId, userHeaders)
      return {
        ok: false,
        error: listRead.httpError,
        diagnostics: connDiag('tools/list', listRead.status, hadSidForList, listRead.httpError),
        httpTrace: {
          request: listReqTrace,
          response: {
            status: listRead.status,
            statusText: '',
            headersText: '',
            body: listRead.raw,
          },
        },
      }
    }

    const tools = normalizeTools(listRead.result)
    const sid = listRead.sessionHeader ?? sessionId

    putHeldSse(sseKey, {
      bridge: legacySse,
      postHref: href,
      sessionId: sid,
      userHeaders: { ...userHeaders },
      lastUsedAt: Date.now(),
      nextRpcId: 3,
    })
    legacySse = null

    return {
      ok: true,
      tools,
      sseHeld: true,
      httpTrace: {
        request: listReqTrace,
        response: {
          status: listRead.status,
          statusText: '',
          headersText: '',
          body: listRead.raw,
        },
      },
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      error: message,
      diagnostics: connDiag('tools/list', null, false, message),
    }
  } finally {
    if (legacySse) legacySse.dispose()
  }
}

async function callMcpToolSseHeld(
  sseBaseUrl: string,
  name: string,
  args: Record<string, unknown>,
  userHeaders: Record<string, string>,
): Promise<CallToolResult> {
  const sseKey = makeSseHeldKey(sseBaseUrl, userHeaders)
  const held = getHeldSse(sseKey)
  if (!held) {
    const detail =
      'No held HTTP/SSE session; refresh tools list for this endpoint first.'
    return {
      ok: false,
      error: detail,
      errorI18n: { key: 'tools.sseNotHeld' },
      diagnostics: connDiag('tools/call', null, false, detail),
    }
  }

  const opSignal = AbortSignal.timeout(60_000)
  const rpcId = held.nextRpcId++
  const bodyObj = {
    jsonrpc: '2.0' as const,
    id: rpcId,
    method: 'tools/call' as const,
    params: { name, arguments: args },
  }
  const mergedHeaders = mergePostHeaders(userHeaders, held.sessionId)
  const bodyStr = JSON.stringify(bodyObj)
  const reqTrace: McpToolCallHttpTrace['request'] = {
    method: 'POST',
    url: held.postHref,
    headersText: sortHeaderLinesFromRecord(mergedHeaders),
    body: bodyStr,
  }

  let callRead: Awaited<ReturnType<typeof postMcpRpcReadResult>>
  try {
    callRead = await postMcpRpcReadResult(
      held.bridge,
      held.postHref,
      bodyObj,
      rpcId,
      held.sessionId,
      opSignal,
      userHeaders,
    )
  } catch (e) {
    disposeHeldSse(sseKey)
    const message = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      error: message,
      diagnostics: connDiag('tools/call', null, !!(held.sessionId && held.sessionId.length > 0), message),
      httpTrace: { request: reqTrace, response: null },
    }
  }

  const httpTrace: McpToolCallHttpTrace = {
    request: reqTrace,
    response: {
      status: callRead.status,
      statusText: '',
      headersText: '',
      body: callRead.raw,
    },
  }

  if (callRead.error) {
    disposeHeldSse(sseKey)
    const hadSidForCall = !!(held.sessionId && held.sessionId.length > 0)
    return {
      ok: false,
      error: `tools/call 失败：${callRead.error.message}`,
      diagnostics: connDiag('tools/call', callRead.status, hadSidForCall, callRead.error.message),
      httpTrace,
    }
  }
  if (callRead.httpError && callRead.result === undefined) {
    disposeHeldSse(sseKey)
    const hadSidForCall = !!(held.sessionId && held.sessionId.length > 0)
    return {
      ok: false,
      error: callRead.httpError,
      diagnostics: connDiag('tools/call', callRead.status, hadSidForCall, callRead.httpError),
      httpTrace,
    }
  }

  const sid = callRead.sessionHeader
  if (sid) held.sessionId = sid
  touchHeldSse(sseKey)
  return { ok: true, result: callRead.result, httpTrace }
}

export async function fetchMcpToolsList(
  endpoint: string,
  extraHeaders?: MCPHttpHeader[],
  reuseSession = false,
  transport: McpHttpTransport = 'streamable-http',
): Promise<FetchToolsResult> {
  const parsed = parseMcpEndpoint(endpoint)
  if (!parsed.ok) return parsed

  const headerErr = validateMcpExtraHeadersForFetch(extraHeaders)
  if (headerErr) {
    return {
      ok: false,
      error: headerErr.detailEn,
      errorI18n: headerErr.detailI18n,
      diagnostics: connDiag('headers', null, false, headerErr.detailEn, headerErr.detailI18n),
    }
  }

  const userHeaders = mcpHeadersToRecord(extraHeaders)

  if (transport === 'sse') {
    return fetchMcpToolsListSse(parsed.href, userHeaders)
  }

  disposeAllHeldSseExcept(null)

  const opSignal = AbortSignal.timeout(60_000)
  const prepared = await prepareMcpPostTransport(parsed.href, transport, userHeaders, opSignal)
  if (!prepared.ok) {
    return {
      ok: false,
      error: prepared.error,
      diagnostics: connDiag('headers', null, false, prepared.error),
    }
  }

  const { href: postHref, legacySse } = prepared

  try {
    const session = await acquireSession(postHref, userHeaders, reuseSession, legacySse)
    if (!session.ok) {
      return {
        ok: false,
        error: session.error,
        diagnostics: session.diagnostics,
        httpTrace: session.httpTrace,
      }
    }

    const { href, sessionId, cacheKey } = session
    const hadSidForList = !!(sessionId && sessionId.length > 0)

    const listPayload = {
      jsonrpc: '2.0' as const,
      id: 2,
      method: 'tools/list' as const,
      params: {},
    }
    const listReqTrace = makePostRequestTrace(href, userHeaders, sessionId, listPayload)

    try {
      let listRead: Awaited<ReturnType<typeof postMcpRpcReadResult>>
      try {
        listRead = await postMcpRpcReadResult(
          legacySse,
          href,
          listPayload,
          2,
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
          httpTrace: { request: listReqTrace, response: null },
        }
      }

      if (listRead.error) {
        if (reuseSession) invalidateMcpSessionCacheKey(cacheKey)
        return {
          ok: false,
          error: `tools/list 失败：${listRead.error.message}`,
          diagnostics: connDiag('tools/list', listRead.status, hadSidForList, listRead.error.message),
          httpTrace: {
            request: listReqTrace,
            response: {
              status: listRead.status,
              statusText: '',
              headersText: '',
              body: listRead.raw,
            },
          },
        }
      }
      if (listRead.httpError && listRead.result === undefined) {
        if (reuseSession) invalidateMcpSessionCacheKey(cacheKey)
        return {
          ok: false,
          error: listRead.httpError,
          diagnostics: connDiag('tools/list', listRead.status, hadSidForList, listRead.httpError),
          httpTrace: {
            request: listReqTrace,
            response: {
              status: listRead.status,
              statusText: '',
              headersText: '',
              body: listRead.raw,
            },
          },
        }
      }

      const tools = normalizeTools(listRead.result)
      if (reuseSession) touchCachedSession(cacheKey)
      return {
        ok: true,
        tools,
        httpTrace: {
          request: listReqTrace,
          response: {
            status: listRead.status,
            statusText: '',
            headersText: '',
            body: listRead.raw,
          },
        },
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (reuseSession) invalidateMcpSessionCacheKey(cacheKey)
      return {
        ok: false,
        error: message,
        diagnostics: connDiag('tools/list', null, hadSidForList, message),
        httpTrace: { request: listReqTrace, response: null },
      }
    } finally {
      if (!reuseSession) {
        closeMcpSession(href, sessionId, userHeaders)
        invalidateMcpSessionCacheKey(cacheKey)
      }
    }
  } finally {
    legacySse?.dispose()
  }
}

export async function callMcpTool(
  endpoint: string,
  toolName: string,
  args: Record<string, unknown>,
  extraHeaders?: MCPHttpHeader[],
  reuseSession = false,
  transport: McpHttpTransport = 'streamable-http',
): Promise<CallToolResult> {
  const parsed = parseMcpEndpoint(endpoint)
  if (!parsed.ok) return parsed

  const name = toolName.trim()
  if (!name) return { ok: false, error: '工具名称为空' }

  const headerErr = validateMcpExtraHeadersForFetch(extraHeaders)
  if (headerErr) {
    return {
      ok: false,
      error: headerErr.detailEn,
      errorI18n: headerErr.detailI18n,
      diagnostics: connDiag('headers', null, false, headerErr.detailEn, headerErr.detailI18n),
    }
  }

  const userHeaders = mcpHeadersToRecord(extraHeaders)

  if (transport === 'sse') {
    return callMcpToolSseHeld(parsed.href, name, args, userHeaders)
  }

  disposeAllHeldSseExcept(null)

  const opSignal = AbortSignal.timeout(60_000)
  const prepared = await prepareMcpPostTransport(parsed.href, transport, userHeaders, opSignal)
  if (!prepared.ok) {
    return {
      ok: false,
      error: prepared.error,
      diagnostics: connDiag('headers', null, false, prepared.error),
    }
  }

  const { href: postHref, legacySse } = prepared

  try {
    const session = await acquireSession(postHref, userHeaders, reuseSession, legacySse)
    if (!session.ok) {
      return {
        ok: false,
        error: session.error,
        diagnostics: session.diagnostics,
        httpTrace: session.httpTrace,
      }
    }

    const { href, sessionId, cacheKey } = session
    const hadSidForCall = !!(sessionId && sessionId.length > 0)

    const TOOLS_CALL_RPC_ID = 3

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

    try {
      let callRead: Awaited<ReturnType<typeof postMcpRpcReadResult>>
      try {
        callRead = await postMcpRpcReadResult(
          legacySse,
          href,
          bodyObj,
          TOOLS_CALL_RPC_ID,
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
          diagnostics: connDiag('tools/call', null, hadSidForCall, message),
          httpTrace: { request: reqTrace, response: null },
        }
      }

      const httpTrace: McpToolCallHttpTrace = {
        request: reqTrace,
        response: {
          status: callRead.status,
          statusText: '',
          headersText: '',
          body: callRead.raw,
        },
      }

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
        httpTrace: { request: reqTrace, response: null },
      }
    } finally {
      if (!reuseSession) {
        closeMcpSession(href, sessionId, userHeaders)
        invalidateMcpSessionCacheKey(cacheKey)
      }
    }
  } finally {
    legacySse?.dispose()
  }
}
