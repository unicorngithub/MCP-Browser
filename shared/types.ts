/** 随 MCP HTTP 请求发送的自定义头（如 Authorization） */
export interface MCPHttpHeader {
  name: string
  value: string
}

/** MCP 远端 HTTP 传输：Streamable HTTP 或 HTTP/SSE */
export type McpHttpTransport = 'streamable-http' | 'sse'

/** 本地持久化的 MCP 服务配置 */
export interface MCPServer {
  id: string
  name: string
  /** 完整 HTTP 端点（含路径），例如 https://host/mcp */
  url: string
  createdAt: number
  /** 可选；对每个请求（含 initialize / tools / DELETE 会话）附加 */
  headers?: MCPHttpHeader[]
  /**
   * 历史/导入字段：解析 JSON 时可出现；本地端点列表不落盘，运行时复用开关见
   * `mcpSessionReuseStore`（按工作区隔离，每次启动默认关）。
   */
  reuseMcpSession?: boolean
}

/** MCP tools/list 返回的单个工具 */
export interface MCPTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: unknown
}

export interface JsonRpcSuccess<T> {
  jsonrpc: '2.0'
  id: string | number
  result: T
}

export interface JsonRpcError {
  jsonrpc: '2.0'
  id: string | number
  error: {
    code: number
    message: string
    data?: unknown
  }
}

/** MCP HTTP 流程中的步骤（与服务端日志对照） */
export type McpConnectStep =
  | 'headers'
  | 'initialize'
  | 'notifications/initialized'
  | 'tools/list'
  | 'tools/call'

/** 渲染进程用 t(key, values) 展示；切换界面语言时无需重新请求即可更新文案 */
export interface McpErrorI18n {
  key: string
  values?: Record<string, string | number>
}

/** 连接 / 请求失败时的分步诊断 */
export interface McpConnectDiagnostics {
  step: McpConnectStep
  /** 该步对应 HTTP 响应状态；尚未收到响应时为 null */
  httpStatus: number | null
  /** 该步请求所带或上一步响应是否已有 MCP-Session-Id（initialize 响应头是否返回会话） */
  hadSessionId: boolean
  /** 简要说明（JSON-RPC message、响应体片段等）；有 detailI18n 时可为英文等兜底文案 */
  detail: string
  /** 若存在，工具面板用当前语言翻译详情（与 detail 同义，可随语言切换） */
  detailI18n?: McpErrorI18n
}

/** MCP HTTP 单次请求/响应原文（tools/call、连接失败步骤等） */
export interface McpToolCallHttpTrace {
  request: {
    method: string
    url: string
    /** 按名称排序的多行 "Name: Value" */
    headersText: string
    body: string
  }
  response: {
    status: number
    statusText: string
    headersText: string
    body: string
  } | null
}

export type FetchToolsResult =
  | { ok: true; tools: MCPTool[]; /** HTTP/SSE：主进程已保持同一条 SSE，后续 tools/call 复用 */ sseHeld?: boolean }
  | {
      ok: false
      error: string
      errorI18n?: McpErrorI18n
      diagnostics?: McpConnectDiagnostics
      /** 失败步骤对应的 HTTP 请求/响应原文（无 HTTP 时仅有 request 或为空） */
      httpTrace?: McpToolCallHttpTrace
    }

/** tools/call 的返回（result 为服务端原始 JSON-RPC result） */
export type CallToolResult =
  | { ok: true; result: unknown; httpTrace?: McpToolCallHttpTrace }
  | {
      ok: false
      error: string
      errorI18n?: McpErrorI18n
      diagnostics?: McpConnectDiagnostics
      httpTrace?: McpToolCallHttpTrace
    }

export type ExportServersJsonResult = { ok: true } | { ok: false; error: string }

export type ImportServersJsonResult =
  | { ok: true; servers: MCPServer[]; count: number }
  | { ok: false; error: string }

/** `mcp:set-servers`：校验通过并已写入 store，或拒绝写入并附带原因 */
export type SetMcpServersResult = { ok: true } | { ok: false; error: string }

/** 更新弹框 i18n：主进程在 IPC 中附带，渲染进程用 t(`update.error${Key}`) 等映射 */
export type UpdateErrorUiKey = 'not_packaged' | 'network' | 'download_failed'
