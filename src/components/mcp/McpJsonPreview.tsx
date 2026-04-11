import { useState, type ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

/**
 * 浅色：Chromium syntax tokens；深色：对齐常见 DevTools 暗色预览（键青、串橙、数/布尔紫）
 */
const punct = 'text-[rgb(117_117_117)] dark:text-[rgb(154_160_166)]'
const keyC = 'text-[rgb(31_31_31)] dark:text-[#7eb6e8]'
const strC = 'text-[rgb(179_38_30)] dark:text-[#e9c0a2]'
const numC = 'text-[rgb(11_87_208)] dark:text-[#c792ea]'
const boolC = 'text-[rgb(185_0_99)] dark:text-[#c792ea]'
const nullC = 'text-[rgb(143_143_143)] dark:text-[rgb(154_160_166)]'

/** 顶行 `{ k: v, … }` 摘要：深色下偏亮灰白，接近 Preview 主文 */
const summaryText = 'text-zinc-800 dark:text-zinc-200'

/** 摘要区强制单行省略，避免长对象在 flex 里折行撑破布局；全文用 title 悬停查看 */
const summaryLineClass = `${summaryText} min-w-0 min-h-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap`

const disclosureTone = 'text-[rgb(95_99_104)] dark:text-[rgb(154_160_166)]'

/** 每层树深度增加的左缩进（`ch` = 当前等宽字体字符宽）；三角与键名/摘要同一行，紧跟在缩进之后 */
const INDENT_CH_PER_DEPTH = 2

function textIndentStyle(depth: number): { paddingLeft: string } {
  return { paddingLeft: `${Math.max(0, depth) * INDENT_CH_PER_DEPTH}ch` }
}

function DisclosurePlaceholder() {
  return <span className="inline-block h-3.5 w-3.5 shrink-0" aria-hidden />
}

/** 子行纵向堆叠，不再额外 pl（缩进仅由每行 `textIndentStyle(depth)` 承担） */
const TREE_CHILD_STACK = 'mt-px w-full space-y-0'

/** 列表中单行字符串超过此长度则省略（与 Preview 中长 PEM 一行展示一致） */
const MAX_LEAF_STRING_CHARS = 88

function formatJsonObjectKey(k: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)
}

const MAX_INLINE_STRING_CHARS = 64

/** 摘要目标最大字符数（用于生成字符串；实际展示单行靠 CSS truncate） */
const MAX_INLINE_SUMMARY_CHARS = 280

/** 完整摘要里最多展示的数组项 / 对象键（避免超大结构卡死） */
const MAX_ARRAY_ITEMS_IN_FULL_SUMMARY = 16
const MAX_OBJECT_KEYS_IN_FULL_SUMMARY = 16

function truncateForInline(s: string): string {
  if (s.length <= MAX_INLINE_STRING_CHARS) return s
  return `${s.slice(0, MAX_INLINE_STRING_CHARS)}…`
}

function inlinePrimitivePreview(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : JSON.stringify(value)
  }
  if (typeof value === 'bigint') return `${String(value)}n`
  if (typeof value === 'string') {
    return JSON.stringify(truncateForInline(value))
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString())
  }
  return String(value)
}

/**
 * 尽量完整的单行摘要：数组为 `[a, b, …]`（不用 `0:` 下标）；嵌套对象展开为 `{k:v,…}`。
 * 仅作候选字符串，过长时由 inlinePreview 改走缩写。
 */
function buildFullInlineSummary(value: unknown): string {
  if (value === null || value === undefined || typeof value !== 'object') {
    return inlinePrimitivePreview(value)
  }
  if (value instanceof Date) {
    return inlinePrimitivePreview(value)
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const slice = value.slice(0, MAX_ARRAY_ITEMS_IN_FULL_SUMMARY)
    const parts = slice.map((v) => buildFullInlineSummary(v))
    const more = value.length > slice.length ? ', …' : ''
    return `[${parts.join(', ')}${more}]`
  }
  const o = value as Record<string, unknown>
  const keys = Object.keys(o)
  if (keys.length === 0) return '{}'
  const slice = keys.slice(0, MAX_OBJECT_KEYS_IN_FULL_SUMMARY)
  const parts = slice.map((k) => `${formatJsonObjectKey(k)}: ${buildFullInlineSummary(o[k])}`)
  const more = keys.length > slice.length ? ', …' : ''
  return `{${parts.join(', ')}${more}}`
}

/**
 * 缩写摘要：嵌套对象/数组在 depth≥1 时变为 `{,…}` / `[,…]`，用于对象整体过长等场景。
 */
function buildAbbrevInlineSummary(value: unknown, nestedDepth = 0): string {
  if (value === null || value === undefined || typeof value !== 'object') {
    return inlinePrimitivePreview(value)
  }
  if (value instanceof Date) {
    return inlinePrimitivePreview(value)
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return buildArraySummaryPreferFirst(value)
  }
  if (nestedDepth >= 1) return '{,…}'
  const o = value as Record<string, unknown>
  const keys = Object.keys(o)
  if (keys.length === 0) return '{}'
  const parts = keys.map((k) => `${formatJsonObjectKey(k)}: ${buildAbbrevInlineSummary(o[k], nestedDepth + 1)}`)
  return `{${parts.join(', ')}}`
}

/**
 * 数组摘要过长时：单行内优先展示**第一条**的完整展开（可截断），其余用 `, …`，避免 `[{,…},{,…},…]`。
 */
function buildArraySummaryPreferFirst(value: unknown[]): string {
  if (value.length === 0) return '[]'
  const tail = value.length > 1 ? ', …' : ''
  const overhead = 1 + tail.length + 1
  const budget = Math.max(12, MAX_INLINE_SUMMARY_CHARS - overhead)
  let first = buildFullInlineSummary(value[0])
  if (first.length > budget) {
    first = `${first.slice(0, Math.max(8, budget - 1))}…`
  }
  return `[${first}${tail}]`
}

/**
 * 单行摘要：默认尽量完整；过长时数组走「首条优先」，对象走缩写。
 */
function inlinePreview(value: unknown): string {
  const full = buildFullInlineSummary(value)
  if (full.length <= MAX_INLINE_SUMMARY_CHARS) return full
  if (Array.isArray(value)) {
    return buildArraySummaryPreferFirst(value)
  }
  return buildAbbrevInlineSummary(value, 0)
}

/** 折叠节点单行摘要：与展开态同一套 {@link inlinePreview}（嵌套不再用无信息的 `{,…}` / `[,…]`） */
function collapsedBlockLabel(value: Record<string, unknown> | unknown[], kind: 'object' | 'array'): string {
  if (kind === 'object') {
    const o = value as Record<string, unknown>
    const keys = Object.keys(o)
    if (keys.length === 0) return '{}'
    return inlinePreview(o)
  }
  const a = value as unknown[]
  if (a.length === 0) return '[]'
  return inlinePreview(a)
}

function RowToggle({
  expanded,
  onToggle,
  labelExpand,
  labelCollapse,
}: {
  expanded: boolean
  onToggle: () => void
  labelExpand: string
  labelCollapse: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        onToggle()
      }}
      className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center self-start rounded ${disclosureTone} hover:bg-black/[0.06] dark:hover:bg-white/[0.08]`}
      aria-expanded={expanded}
      aria-label={expanded ? labelCollapse : labelExpand}
    >
      <svg
        viewBox="0 0 12 12"
        className={`h-2 w-2 transition-transform ${expanded ? 'rotate-90' : ''}`}
        fill="currentColor"
        aria-hidden
      >
        <path d="M4 1.5L9 6l-5 4.5V1.5z" />
      </svg>
    </button>
  )
}

function JsonLeaf({ value }: { value: unknown }): ReactNode {
  if (value === undefined) {
    return <span className={nullC}>undefined</span>
  }
  if (value === null) {
    return <span className={nullC}>null</span>
  }
  if (typeof value === 'boolean') {
    return <span className={boolC}>{value ? 'true' : 'false'}</span>
  }
  if (typeof value === 'number') {
    return (
      <span className={numC}>
        {Number.isFinite(value) ? String(value) : JSON.stringify(value)}
      </span>
    )
  }
  if (typeof value === 'bigint') {
    return <span className={numC}>{String(value)}</span>
  }
  if (typeof value === 'string') {
    const raw = value
    const hasNl = /[\r\n]/.test(raw)
    if (!hasNl && raw.length > MAX_LEAF_STRING_CHARS) {
      const cut = `${raw.slice(0, MAX_LEAF_STRING_CHARS)}…`
      return (
        <span className={`${strC} break-all`} title={JSON.stringify(raw)}>
          {JSON.stringify(cut)}
        </span>
      )
    }
    if (hasNl) {
      const lines = raw.split(/\r?\n/)
      return (
        <span className={`${strC} break-words`}>
          <span>&quot;</span>
          {lines.map((line, i) => {
            const seg = JSON.stringify(line).slice(1, -1)
            return (
              <span key={i}>
                {i > 0 ? (
                  <>
                    <br />
                    <span className="block" style={{ paddingLeft: `${INDENT_CH_PER_DEPTH}ch` }}>
                      {seg}
                    </span>
                  </>
                ) : (
                  seg
                )}
              </span>
            )
          })}
          <span>&quot;</span>
        </span>
      )
    }
    return <span className={`${strC} break-words`}>{JSON.stringify(raw)}</span>
  }
  if (value instanceof Date) {
    return <span className={strC}>{JSON.stringify(value.toISOString())}</span>
  }
  return <span className={strC}>{JSON.stringify(value)}</span>
}

/** 仅含换行的字符串用多行（键、`:`、值分行） */
function isMultilinePropertyValue(value: unknown): boolean {
  return typeof value === 'string' && /[\r\n]/.test(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
}

/** 箭头在属性名前：`▶ content : [0: {,…}]` */
function ObjectPropertyRowArray({
  name,
  value,
  depth,
  defaultCollapseDepth,
  t,
}: {
  name: string
  value: unknown[]
  depth: number
  defaultCollapseDepth: number
  t: TFunction
}) {
  const defaultOpen = depth < defaultCollapseDepth
  const [open, setOpen] = useState(defaultOpen)
  const labelExpand = t('tools.jsonPreviewExpandNode')
  const labelCollapse = t('tools.jsonPreviewCollapseNode')
  const collapsedLabel = collapsedBlockLabel(value, 'array')
  const expandedHeader = inlinePreview(value)

  return (
    <div className="min-w-0 w-full max-w-full">
      <div
        className="flex min-w-0 w-full max-w-full items-start gap-x-0.5 py-px"
        style={textIndentStyle(depth)}
      >
        <RowToggle
          expanded={open}
          onToggle={() => setOpen((o) => !o)}
          labelExpand={labelExpand}
          labelCollapse={labelCollapse}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-x-1.5">
            <span className={`${keyC} shrink-0`}>{formatJsonObjectKey(name)}</span>
            <span className={`${punct} shrink-0`}>:</span>
            <span
              className={summaryLineClass}
              title={open ? expandedHeader : collapsedLabel}
            >
              {open ? expandedHeader : collapsedLabel}
            </span>
          </div>
        </div>
      </div>
      {open ? (
        <div className={TREE_CHILD_STACK}>
          {value.map((item, i) => (
            <ObjectPropertyRow
              key={i}
              name={String(i)}
              value={item}
              depth={depth + 1}
              defaultCollapseDepth={defaultCollapseDepth}
              t={t}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ObjectPropertyRowObject({
  name,
  value,
  depth,
  defaultCollapseDepth,
  t,
}: {
  name: string
  value: Record<string, unknown>
  depth: number
  defaultCollapseDepth: number
  t: TFunction
}) {
  const entries = Object.entries(value)
  const defaultOpen = depth < defaultCollapseDepth
  const [open, setOpen] = useState(defaultOpen)
  const labelExpand = t('tools.jsonPreviewExpandNode')
  const labelCollapse = t('tools.jsonPreviewCollapseNode')
  const collapsedLabel = collapsedBlockLabel(value, 'object')
  const expandedHeader = inlinePreview(value)

  return (
    <div className="min-w-0 w-full max-w-full">
      <div
        className="flex min-w-0 w-full max-w-full items-start gap-x-0.5 py-px"
        style={textIndentStyle(depth)}
      >
        <RowToggle
          expanded={open}
          onToggle={() => setOpen((o) => !o)}
          labelExpand={labelExpand}
          labelCollapse={labelCollapse}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-x-1.5">
            <span className={`${keyC} shrink-0`}>{formatJsonObjectKey(name)}</span>
            <span className={`${punct} shrink-0`}>:</span>
            <span
              className={summaryLineClass}
              title={open ? expandedHeader : collapsedLabel}
            >
              {open ? expandedHeader : collapsedLabel}
            </span>
          </div>
        </div>
      </div>
      {open ? (
        <div className={TREE_CHILD_STACK}>
          {entries.map(([k, v]) => (
            <ObjectPropertyRow
              key={k}
              name={k}
              value={v}
              depth={depth + 1}
              defaultCollapseDepth={defaultCollapseDepth}
              t={t}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ObjectPropertyRow({
  name,
  value,
  depth,
  defaultCollapseDepth,
  t,
}: {
  name: string
  value: unknown
  depth: number
  defaultCollapseDepth: number
  t: TFunction
}) {
  if (isMultilinePropertyValue(value)) {
    return (
      <div
        className="flex min-w-0 w-full max-w-full items-start gap-x-0.5 py-px"
        style={textIndentStyle(depth)}
      >
        <DisclosurePlaceholder />
        <div className="min-w-0 flex-1">
          <div className={`${keyC} min-w-0 break-all`}>{formatJsonObjectKey(name)}</div>
          <div className={punct}>:</div>
          <div className="min-w-0">
            <JsonValue
              value={value}
              depth={depth}
              defaultCollapseDepth={defaultCollapseDepth}
              t={t}
            />
          </div>
        </div>
      </div>
    )
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div
          className="flex min-w-0 w-full max-w-full items-start gap-x-0.5 py-px"
          style={textIndentStyle(depth)}
        >
          <DisclosurePlaceholder />
          <div className="flex min-w-0 flex-1 items-baseline gap-x-1.5">
            <span className={`${keyC} shrink-0`}>{formatJsonObjectKey(name)}</span>
            <span className={`${punct} shrink-0`}>:</span>
            <span className={punct}>[]</span>
          </div>
        </div>
      )
    }
    return (
      <ObjectPropertyRowArray
        name={name}
        value={value}
        depth={depth}
        defaultCollapseDepth={defaultCollapseDepth}
        t={t}
      />
    )
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value)
    if (entries.length === 0) {
      return (
        <div
          className="flex min-w-0 w-full max-w-full items-start gap-x-0.5 py-px"
          style={textIndentStyle(depth)}
        >
          <DisclosurePlaceholder />
          <div className="flex min-w-0 flex-1 items-baseline gap-x-1.5">
            <span className={`${keyC} shrink-0`}>{formatJsonObjectKey(name)}</span>
            <span className={`${punct} shrink-0`}>:</span>
            <span className={punct}>{'{}'}</span>
          </div>
        </div>
      )
    }
    return (
      <ObjectPropertyRowObject
        name={name}
        value={value}
        depth={depth}
        defaultCollapseDepth={defaultCollapseDepth}
        t={t}
      />
    )
  }

  return (
    <div
      className="flex min-w-0 w-full max-w-full items-start gap-x-0.5 py-px"
      style={textIndentStyle(depth)}
    >
      <DisclosurePlaceholder />
      <div className="flex min-w-0 flex-1 items-baseline gap-x-1.5">
        <span className={`${keyC} shrink-0`}>{formatJsonObjectKey(name)}</span>
        <span className={`${punct} shrink-0`}>:</span>
        <div className="min-w-0 flex-1">
          <JsonValue
            value={value}
            depth={depth}
            defaultCollapseDepth={defaultCollapseDepth}
            t={t}
          />
        </div>
      </div>
    </div>
  )
}

function ObjectBlock({
  value,
  depth,
  defaultCollapseDepth,
  t,
}: {
  value: Record<string, unknown>
  depth: number
  defaultCollapseDepth: number
  t: TFunction
}) {
  const entries = Object.entries(value)
  const defaultOpen = depth < defaultCollapseDepth
  const [open, setOpen] = useState(defaultOpen)
  const labelExpand = t('tools.jsonPreviewExpandNode')
  const labelCollapse = t('tools.jsonPreviewCollapseNode')
  const expandedHeaderSummary = inlinePreview(value)

  if (entries.length === 0) {
    return <span className={punct}>{'{}'}</span>
  }

  if (!open) {
    const label = collapsedBlockLabel(value, 'object')
    return (
      <div
        className="flex min-w-0 max-w-full items-start gap-x-0.5"
        style={textIndentStyle(depth)}
      >
        <RowToggle
          expanded={false}
          onToggle={() => setOpen(true)}
          labelExpand={labelExpand}
          labelCollapse={labelCollapse}
        />
        <span className={summaryLineClass} title={label}>
          {label}
        </span>
      </div>
    )
  }

  return (
    <div className="min-w-0 w-full max-w-full">
      <div
        className="flex min-w-0 max-w-full items-start gap-x-0.5"
        style={textIndentStyle(depth)}
      >
        <RowToggle
          expanded
          onToggle={() => setOpen(false)}
          labelExpand={labelExpand}
          labelCollapse={labelCollapse}
        />
        <span className={summaryLineClass} title={expandedHeaderSummary}>
          {expandedHeaderSummary}
        </span>
      </div>
      <div className={TREE_CHILD_STACK}>
        {entries.map(([k, v]) => (
          <ObjectPropertyRow
            key={k}
            name={k}
            value={v}
            depth={depth + 1}
            defaultCollapseDepth={defaultCollapseDepth}
            t={t}
          />
        ))}
      </div>
    </div>
  )
}

function ArrayBlock({
  value,
  depth,
  defaultCollapseDepth,
  t,
}: {
  value: unknown[]
  depth: number
  defaultCollapseDepth: number
  t: TFunction
}) {
  const defaultOpen = depth < defaultCollapseDepth
  const [open, setOpen] = useState(defaultOpen)
  const labelExpand = t('tools.jsonPreviewExpandNode')
  const labelCollapse = t('tools.jsonPreviewCollapseNode')
  const expandedHeaderSummary = inlinePreview(value)

  if (value.length === 0) {
    return <span className={punct}>[]</span>
  }

  if (!open) {
    const label = collapsedBlockLabel(value, 'array')
    return (
      <div
        className="flex min-w-0 max-w-full items-start gap-x-0.5"
        style={textIndentStyle(depth)}
      >
        <RowToggle
          expanded={false}
          onToggle={() => setOpen(true)}
          labelExpand={labelExpand}
          labelCollapse={labelCollapse}
        />
        <span className={summaryLineClass} title={label}>
          {label}
        </span>
      </div>
    )
  }

  return (
    <div className="min-w-0 w-full max-w-full">
      <div
        className="flex min-w-0 max-w-full items-start gap-x-0.5"
        style={textIndentStyle(depth)}
      >
        <RowToggle
          expanded
          onToggle={() => setOpen(false)}
          labelExpand={labelExpand}
          labelCollapse={labelCollapse}
        />
        <span className={summaryLineClass} title={expandedHeaderSummary}>
          {expandedHeaderSummary}
        </span>
      </div>
      <div className={TREE_CHILD_STACK}>
        {value.map((item, i) => (
          <ObjectPropertyRow
            key={i}
            name={String(i)}
            value={item}
            depth={depth + 1}
            defaultCollapseDepth={defaultCollapseDepth}
            t={t}
          />
        ))}
      </div>
    </div>
  )
}

function JsonValue({
  value,
  depth,
  defaultCollapseDepth,
  t,
}: {
  value: unknown
  depth: number
  defaultCollapseDepth: number
  t: TFunction
}) {
  if (value === null || typeof value !== 'object') {
    return <JsonLeaf value={value} />
  }
  if (value instanceof Date) {
    return <JsonLeaf value={value} />
  }
  if (Array.isArray(value)) {
    return (
      <ArrayBlock
        value={value}
        depth={depth}
        defaultCollapseDepth={defaultCollapseDepth}
        t={t}
      />
    )
  }
  return (
    <ObjectBlock
      value={value as Record<string, unknown>}
      depth={depth}
      defaultCollapseDepth={defaultCollapseDepth}
      t={t}
    />
  )
}

type Props = {
  value: unknown
  /** 深度 &lt; 该值时默认展开（根深度为 0） */
  defaultCollapseDepth?: number
}

export function McpJsonPreview({ value, defaultCollapseDepth = 3 }: Props) {
  const { t } = useTranslation()
  return (
    <div className="mcp-devtools-json-preview w-full min-w-0 max-w-full select-text text-[rgb(31_31_31)] dark:text-[rgb(227_227_227)]">
      <JsonValue
        value={value}
        depth={0}
        defaultCollapseDepth={defaultCollapseDepth}
        t={t}
      />
    </div>
  )
}
