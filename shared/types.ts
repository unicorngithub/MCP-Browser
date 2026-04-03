/** 本地持久化的 MCP 服务配置 */
export interface MCPServer {
  id: string
  name: string
  /** 完整 HTTP 端点（含路径），例如 https://host/mcp */
  url: string
  createdAt: number
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

export type FetchToolsResult =
  | { ok: true; tools: MCPTool[] }
  | { ok: false; error: string }

/** tools/call 的返回（result 为服务端原始 JSON-RPC result） */
export type CallToolResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string }
