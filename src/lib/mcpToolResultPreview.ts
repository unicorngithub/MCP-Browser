/** 若整段 trim 后以 `{` / `[` 开头且可 JSON.parse，返回解析值，否则 null（避免误解析普通文案） */
export function tryParseEmbeddedJsonString(s: string): unknown | null {
  const t = s.trim()
  if (t.length < 2) return null
  const c = t[0]
  if (c !== '{' && c !== '[') return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return null
  }
}

const MCP_PREVIEW_JSON_DEPTH_MAX = 8

/** 对解析后的对象/数组做一层层展开：字符串值若仍是 JSON 对象/数组则继续 parse（用于套娃字符串） */
export function deepExpandParsedJsonInPreview(value: unknown, depth = 0): unknown {
  if (depth > MCP_PREVIEW_JSON_DEPTH_MAX) return value
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'string') {
      const p = tryParseEmbeddedJsonString(value)
      if (p !== null) return deepExpandParsedJsonInPreview(p, depth + 1)
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map((x) => deepExpandParsedJsonInPreview(x, depth + 1))
  }
  const o = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(o)) {
    out[k] = deepExpandParsedJsonInPreview(o[k], depth + 1)
  }
  return out
}

function expandContentBlockForPreview(item: unknown): unknown {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) {
    return expandMcpToolResultForPreview(item)
  }
  const block = item as Record<string, unknown>
  if (block.type === 'text' && typeof block.text === 'string') {
    const parsed = tryParseEmbeddedJsonString(block.text)
    if (parsed !== null) {
      return { ...block, text: deepExpandParsedJsonInPreview(parsed) }
    }
  }
  return expandMcpToolResultForPreview(block)
}

/** tools/call 的 result：把 content[].text 内嵌的 JSON 字符串展开为嵌套结构，便于 Preview 阅读 */
export function expandMcpToolResultForPreview(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.map((x) => expandMcpToolResultForPreview(x))
  }
  const o = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(o)) {
    const v = o[key]
    if (key === 'content' && Array.isArray(v)) {
      out[key] = v.map((item) => expandContentBlockForPreview(item))
    } else {
      out[key] = expandMcpToolResultForPreview(v)
    }
  }
  return out
}

export function safeJsonStringify(value: unknown, indent?: number): string {
  try {
    return JSON.stringify(value, null, indent ?? undefined)
  } catch {
    return String(value)
  }
}
