/** 随 MCP HTTP 请求发送的自定义头（如 Authorization） */
export interface MCPHttpHeader {
  name: string
  value: string
}

/** 本地持久化的 MCP 服务配置 */
export interface MCPServer {
  id: string
  name: string
  /** 完整 HTTP 端点（含路径），例如 https://host/mcp */
  url: string
  createdAt: number
  /** 可选；对每个请求（含 initialize / tools / DELETE 会话）附加 */
  headers?: MCPHttpHeader[]
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
  | 'initialize'
  | 'notifications/initialized'
  | 'tools/list'
  | 'tools/call'

/** 连接 / 请求失败时的分步诊断 */
export interface McpConnectDiagnostics {
  step: McpConnectStep
  /** 该步对应 HTTP 响应状态；尚未收到响应时为 null */
  httpStatus: number | null
  /** 该步请求所带或上一步响应是否已有 MCP-Session-Id（initialize 响应头是否返回会话） */
  hadSessionId: boolean
  /** 简要说明（JSON-RPC message、响应体片段等） */
  detail: string
}

export type FetchToolsResult =
  | { ok: true; tools: MCPTool[] }
  | { ok: false; error: string; diagnostics?: McpConnectDiagnostics }

/** 单次 tools/call 对应的 HTTP 请求/响应原文（供「查看详情」） */
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

/** tools/call 的返回（result 为服务端原始 JSON-RPC result） */
export type CallToolResult =
  | { ok: true; result: unknown; httpTrace?: McpToolCallHttpTrace }
  | { ok: false; error: string; diagnostics?: McpConnectDiagnostics; httpTrace?: McpToolCallHttpTrace }

export type ExportServersJsonResult = { ok: true } | { ok: false; error: string }

export type ImportServersJsonResult =
  | { ok: true; servers: MCPServer[]; count: number }
  | { ok: false; error: string }

/** `mcp:set-servers`：校验通过并已写入 store，或拒绝写入并附带原因 */
export type SetMcpServersResult = { ok: true } | { ok: false; error: string }

/** 更新弹框 i18n：主进程在 IPC 中附带，渲染进程用 t(`update.error${Key}`) 等映射 */
export type UpdateErrorUiKey = 'not_packaged' | 'network' | 'download_failed'
