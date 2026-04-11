function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * 去掉 SSE 帧里的 `event:` 整行，以及 `data:` 前缀，保留其后原文（不 parse、不缩进排版）。
 * 多条 `data:` 用换行拼接。非 SSE 正文原样返回。
 */
function stripSseFramingFromResponseBody(raw: string): string {
  const lines = raw.split(/\r?\n/)
  let sawSseField = false
  const payloads: string[] = []

  for (const line of lines) {
    const t = line.trimStart()
    if (t.startsWith('event:')) {
      sawSseField = true
      continue
    }
    if (t.startsWith('data:')) {
      sawSseField = true
      const payload = t.slice(5).trimStart()
      if (payload && payload !== '[DONE]') payloads.push(payload)
      continue
    }
    if (t.startsWith('id:') || t.startsWith('retry:')) {
      sawSseField = true
      continue
    }
  }

  if (sawSseField) return payloads.join('\n')
  return raw
}

/**
 * 工具调用结果区「Response」标签：去掉 SSE 包装后，若为 JSON-RPC 2.0 成功响应则只保留 `result`
 *（紧凑 JSON 字符串，无缩进）；含 `error` 或非 JSON-RPC 时保持剥离 SSE 后的原文。
 * 不用于 HTTP 详情弹窗（详情页须完整原始 trace）。
 */
export function formatToolCallResponseTabText(raw: string): string {
  const stripped = stripSseFramingFromResponseBody(raw)
  const t = stripped.trim()
  if (!t) return stripped
  try {
    const j = JSON.parse(t) as unknown
    if (!isRecord(j) || j.jsonrpc !== '2.0') return stripped
    if (j.error != null) return stripped
    if ('result' in j) return JSON.stringify(j.result)
  } catch {
    /* 非 JSON 或无法解析 */
  }
  return stripped
}
