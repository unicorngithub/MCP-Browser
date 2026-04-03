/** 将 MCP 工具的 inputSchema（JSON Schema 子集）解析为可渲染的表单字段 */

export type FieldKind = 'enum' | 'string' | 'number' | 'integer' | 'boolean' | 'json'

export interface ParsedField {
  key: string
  kind: FieldKind
  required: boolean
  description?: string
  title?: string
  enumValues?: (string | number | boolean)[]
  default?: unknown
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function pickNonNullType(typeField: unknown): string | null {
  if (typeof typeField === 'string') return typeField
  if (!Array.isArray(typeField)) return null
  const prim = typeField.filter((t) => t !== 'null' && t !== undefined)
  if (prim.length !== 1 || typeof prim[0] !== 'string') return null
  return prim[0]
}

function readEnum(s: Record<string, unknown>): (string | number | boolean)[] | null {
  if (!Array.isArray(s.enum) || s.enum.length === 0) return null
  const ok = s.enum.every(
    (v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean',
  )
  if (!ok) return null
  return s.enum as (string | number | boolean)[]
}

function parseField(key: string, s: Record<string, unknown>, required: boolean): ParsedField | null {
  const description = typeof s.description === 'string' ? s.description : undefined
  const title = typeof s.title === 'string' ? s.title : undefined
  const def = 'default' in s ? s.default : undefined

  const enums = readEnum(s)
  if (enums) {
    return { key, kind: 'enum', required, description, title, default: def, enumValues: enums }
  }

  if (s.oneOf != null || s.anyOf != null || s.allOf != null) {
    return { key, kind: 'json', required, description, title, default: def }
  }

  const t = pickNonNullType(s.type)
  if (t === 'boolean') {
    return { key, kind: 'boolean', required, description, title, default: def }
  }
  if (t === 'integer') {
    return { key, kind: 'integer', required, description, title, default: def }
  }
  if (t === 'number') {
    return { key, kind: 'number', required, description, title, default: def }
  }
  if (t === 'object' || t === 'array') {
    return { key, kind: 'json', required, description, title, default: def }
  }
  if (isRecord(s.properties)) {
    return { key, kind: 'json', required, description, title, default: def }
  }
  if (t === 'string' || t == null) {
    return { key, kind: 'string', required, description, title, default: def }
  }
  return { key, kind: 'json', required, description, title, default: def }
}

/** 从 inputSchema 解析顶层 properties，得到表单字段列表（可能为空） */
export function parseMcpToolInputSchema(
  inputSchema: Record<string, unknown> | undefined,
): ParsedField[] {
  if (!isRecord(inputSchema)) return []
  const props = inputSchema.properties
  if (!isRecord(props)) return []

  const requiredSet = new Set(
    Array.isArray(inputSchema.required)
      ? inputSchema.required.filter((x): x is string => typeof x === 'string')
      : [],
  )

  const fields: ParsedField[] = []
  for (const key of Object.keys(props)) {
    const sub = props[key]
    if (!isRecord(sub)) continue
    const f = parseField(key, sub, requiredSet.has(key))
    if (f) fields.push(f)
  }
  return fields
}

function defaultToString(f: ParsedField): string {
  const d = f.default
  if (d === undefined) return ''
  if (f.kind === 'json') {
    try {
      return JSON.stringify(d, null, 2)
    } catch {
      return String(d)
    }
  }
  if (f.kind === 'boolean') {
    if (typeof d === 'boolean') return d ? 'true' : 'false'
    return ''
  }
  return String(d)
}

/** 根据 schema 生成表单初始字符串值（与 UI 控件绑定） */
export function initialFormValues(fields: ParsedField[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of fields) {
    if (f.default !== undefined) {
      out[f.key] = defaultToString(f)
      continue
    }
    if (f.kind === 'boolean') {
      out[f.key] = f.required ? 'false' : ''
      continue
    }
    if (f.kind === 'enum') {
      out[f.key] = f.required && f.enumValues?.length ? String(f.enumValues[0]) : ''
      continue
    }
    out[f.key] = ''
  }
  return out
}

export type BuildArgsResult =
  | { ok: true; args: Record<string, unknown> }
  | { ok: false; error: string }

/** 将表单字符串值合并为 tools/call 的 arguments 对象 */
export function buildArgumentsFromForm(
  fields: ParsedField[],
  values: Record<string, string>,
): BuildArgsResult {
  const args: Record<string, unknown> = {}

  for (const f of fields) {
    const raw = values[f.key] ?? ''
    const trimmed = typeof raw === 'string' ? raw.trim() : raw

    if (f.kind === 'boolean') {
      if (trimmed === '') {
        if (f.required) return { ok: false, error: `请为「${f.key}」选择布尔值` }
        continue
      }
      if (trimmed !== 'true' && trimmed !== 'false') {
        return { ok: false, error: `字段「${f.key}」布尔值无效` }
      }
      args[f.key] = trimmed === 'true'
      continue
    }

    if (f.kind === 'enum') {
      if (trimmed === '') {
        if (f.required) return { ok: false, error: `请选择「${f.key}」` }
        continue
      }
      const ev = f.enumValues ?? []
      const hit = ev.find((v) => String(v) === trimmed)
      if (hit === undefined) return { ok: false, error: `「${f.key}」选项无效` }
      args[f.key] = hit
      continue
    }

    if (f.kind === 'number' || f.kind === 'integer') {
      if (trimmed === '') {
        if (f.required) return { ok: false, error: `请填写数字字段「${f.key}」` }
        continue
      }
      const n = Number(trimmed)
      if (Number.isNaN(n)) {
        return { ok: false, error: `「${f.key}」须为有效数字` }
      }
      if (f.kind === 'integer' && !Number.isInteger(n)) {
        return { ok: false, error: `「${f.key}」须为整数` }
      }
      args[f.key] = n
      continue
    }

    if (f.kind === 'json') {
      if (trimmed === '') {
        if (f.required) return { ok: false, error: `请填写 JSON 字段「${f.key}」` }
        continue
      }
      try {
        args[f.key] = JSON.parse(trimmed) as unknown
      } catch {
        return { ok: false, error: `「${f.key}」JSON 无法解析` }
      }
      continue
    }

    // string
    if (trimmed === '') {
      if (f.required) return { ok: false, error: `请填写「${f.key}」` }
      continue
    }
    args[f.key] = trimmed
  }

  return { ok: true, args }
}
