import { useMemo, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useAddressStore } from '@/stores/addressStore'
import { useToolsStore } from '@/stores/toolsStore'
import { ToolArgsForm } from '@/components/mcp/ToolArgsForm'
import {
  buildArgumentsFromForm,
  initialFormValues,
  parseMcpToolInputSchema,
} from '@/lib/mcpInputSchema'

function EmptyHint({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800/80 text-xl text-zinc-500">
        ◇
      </div>
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      {detail ? <p className="mt-2 max-w-xs text-xs leading-relaxed text-zinc-600">{detail}</p> : null}
    </div>
  )
}

function ToolbarIcon({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span className={`inline-flex h-4 w-4 shrink-0 items-center justify-center ${className}`}>
      {children}
    </span>
  )
}

export function ToolsPanel() {
  const { servers, selectedId } = useAddressStore()
  const selected = useMemo(
    () => servers.find((s) => s.id === selectedId) ?? null,
    [servers, selectedId],
  )

  const {
    tools,
    connection,
    error,
    lastUrl,
    lastHeaders,
    selectedToolName,
    fetchForUrl,
    setSelectedTool,
  } = useToolsStore()

  const selectedTool = useMemo(
    () => tools.find((t) => t.name === selectedToolName) ?? null,
    [tools, selectedToolName],
  )

  const [copyDone, setCopyDone] = useState(false)

  const [toolArgsJson, setToolArgsJson] = useState('{}')
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [argsMode, setArgsMode] = useState<'form' | 'json'>('json')
  const [argsParseError, setArgsParseError] = useState<string | null>(null)
  const [callLoading, setCallLoading] = useState(false)
  const [callError, setCallError] = useState<string | null>(null)
  const [callResult, setCallResult] = useState<unknown>(null)
  const [inputSchemaOpen, setInputSchemaOpen] = useState(true)
  const [toolTestOpen, setToolTestOpen] = useState(true)

  const schemaFields = useMemo(
    () => parseMcpToolInputSchema(selectedTool?.inputSchema),
    [selectedTool],
  )

  useEffect(() => {
    setToolArgsJson('{}')
    setFormValues(initialFormValues(schemaFields))
    setArgsMode(schemaFields.length > 0 ? 'form' : 'json')
    setArgsParseError(null)
    setCallError(null)
    setCallResult(null)
    setInputSchemaOpen(true)
    setToolTestOpen(true)
  }, [selectedToolName, schemaFields])

  const setFormField = useCallback((key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const runToolTest = useCallback(async () => {
    if (!selected?.url || !selectedTool) return
    let args: Record<string, unknown>
    if (argsMode === 'form' && schemaFields.length > 0) {
      const built = buildArgumentsFromForm(schemaFields, formValues)
      if (!built.ok) {
        setArgsParseError(built.error)
        return
      }
      args = built.args
    } else {
      try {
        const parsed: unknown = JSON.parse(toolArgsJson || '{}')
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setArgsParseError('顶层须为 JSON 对象，例如 {} 或 {"key":"value"}')
          return
        }
        args = parsed as Record<string, unknown>
      } catch {
        setArgsParseError('JSON 格式无效')
        return
      }
    }
    setArgsParseError(null)
    setCallError(null)
    setCallResult(null)
    setCallLoading(true)
    try {
      const out = await window.mcpDesktop.callTool(
        selected.url,
        selectedTool.name,
        args,
        selected.headers,
      )
      if (!out.ok) {
        setCallError(out.error)
        return
      }
      setCallResult(out.result)
    } catch (e) {
      setCallError(e instanceof Error ? e.message : String(e))
    } finally {
      setCallLoading(false)
    }
  }, [selected?.url, selected?.headers, selectedTool, toolArgsJson, argsMode, schemaFields, formValues])

  const statusLabel =
    connection === 'idle'
      ? '待命'
      : connection === 'loading'
        ? '连接中'
        : connection === 'ok'
          ? '已连接'
          : '失败'

  const statusDot =
    connection === 'ok'
      ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.45)]'
      : connection === 'error'
        ? 'bg-red-400'
        : connection === 'loading'
          ? 'animate-pulse bg-amber-400'
          : 'bg-zinc-500'

  const retry = useCallback(() => {
    const u = selected?.url ?? lastUrl
    const h = selected?.headers ?? lastHeaders
    if (u) void fetchForUrl(u, h)
  }, [selected?.url, selected?.headers, lastUrl, lastHeaders, fetchForUrl])

  const copyUrl = useCallback(async () => {
    if (!selected?.url) return
    try {
      await navigator.clipboard.writeText(selected.url)
      setCopyDone(true)
      window.setTimeout(() => setCopyDone(false), 2000)
    } catch {
      /* 忽略 */
    }
  }, [selected?.url])

  const showToolCount = Boolean(selected && connection === 'ok')

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-zinc-950/40">
      {/* 主工具栏 */}
      <header className="flex min-h-[3.25rem] shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/[0.06] bg-gradient-to-b from-zinc-900/50 to-zinc-950/80 px-4 py-2.5 backdrop-blur-md sm:px-5">
        <div className="min-w-0 flex-1 basis-[min(100%,14rem)]">
          <h1
            data-testid="mcp-tools-header"
            className="truncate text-base font-semibold leading-tight tracking-tight text-white sm:text-lg"
          >
            {selected ? selected.name : '选择 MCP 服务'}
          </h1>
          {selected ? (
            <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500 sm:text-xs" title={selected.url}>
              {selected.url}
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-zinc-600 sm:text-xs">在侧栏选择地址后在此查看工具</p>
          )}
        </div>

        <div
          className="flex flex-wrap items-center gap-2 sm:gap-1.5"
          role="toolbar"
          aria-label="连接与操作"
        >
          {showToolCount ? (
            <span
              className="order-first rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[11px] font-medium tabular-nums text-cyan-200/90 sm:order-none"
              title="当前端点返回的工具数量"
            >
              {tools.length} 工具
            </span>
          ) : null}

          <div
            className="hidden h-7 w-px bg-white/[0.08] sm:block"
            aria-hidden
            role="separator"
          />

          <div
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-950/60 px-2.5 py-1.5 sm:px-3"
            title="与 MCP 服务端的连接状态"
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot}`} aria-hidden />
            <span className="text-xs font-medium text-zinc-200">{statusLabel}</span>
          </div>

          <div className="hidden h-7 w-px bg-white/[0.08] sm:block" aria-hidden role="separator" />

          <div className="flex items-center gap-1.5">
            {selected?.url ? (
              <button
                type="button"
                onClick={() => void copyUrl()}
                title="复制端点 URL"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/90 bg-zinc-900/70 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
              >
                <ToolbarIcon>
                  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="h-3.5 w-3.5 opacity-80">
                    <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2v2a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V2zm0 2v2h6a2 2 0 0 1 2 2v6h2V2H4zm2 4H2v8h8V8H6z" />
                  </svg>
                </ToolbarIcon>
                <span className="hidden sm:inline">{copyDone ? '已复制' : '复制 URL'}</span>
                <span className="sm:hidden">{copyDone ? '✓' : '复制'}</span>
              </button>
            ) : null}

            {selected ? (
              <button
                type="button"
                onClick={retry}
                disabled={connection === 'loading'}
                title={connection === 'loading' ? '正在请求…' : '重新执行 initialize 与 tools/list'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-gradient-to-b from-cyan-500/15 to-teal-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-400/50 hover:from-cyan-500/25 hover:to-teal-500/15 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ToolbarIcon className={connection === 'loading' ? 'animate-spin' : ''}>
                  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="h-3.5 w-3.5">
                    <path d="M8 0a8 8 0 1 0 8 8h-2A6 6 0 1 1 8 2V0z" />
                  </svg>
                </ToolbarIcon>
                {connection === 'loading' ? '刷新中…' : '刷新列表'}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {connection === 'error' && error ? (
        <div className="mx-4 mt-3 rounded-xl border border-red-500/25 bg-red-950/35 px-4 py-3 text-sm text-red-200/95 shadow-lg shadow-red-900/20 sm:mx-5">
          {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <section className="flex w-[min(100%,24rem)] shrink-0 flex-col border-r border-white/[0.06] bg-zinc-950/30">
          <div className="flex h-10 shrink-0 items-center border-b border-white/[0.04] bg-zinc-950/40 px-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Tools</span>
            {connection === 'ok' && tools.length > 0 ? (
              <span className="ml-2 rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-400">
                {tools.length}
              </span>
            ) : null}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {connection === 'loading' ? (
              <EmptyHint title="正在拉取 tools/list…" detail="按 MCP 规范完成握手与请求" />
            ) : !selected ? (
              <EmptyHint title="未选择服务" detail="请先在侧栏添加并点击一个 MCP 地址" />
            ) : connection === 'ok' && tools.length === 0 ? (
              <EmptyHint title="暂无工具" detail="该端点未返回任何 tool" />
            ) : connection === 'ok' ? (
              <ul data-testid="mcp-tool-list" className="flex flex-col gap-2">
                {tools.map((t) => {
                  const on = t.name === selectedToolName
                  return (
                    <li key={t.name}>
                      <button
                        type="button"
                        onClick={() => setSelectedTool(t.name)}
                        className={`w-full rounded-xl border px-3.5 py-3 text-left transition-all ${
                          on
                            ? 'border-cyan-500/35 bg-gradient-to-br from-cyan-500/10 to-transparent shadow-panel'
                            : 'border-transparent bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900'
                        }`}
                      >
                        <div className="font-medium text-zinc-100">{t.name}</div>
                        {t.description ? (
                          <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                            {t.description}
                          </div>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        </section>

        <section className="min-w-0 flex-1 overflow-y-auto bg-zinc-950/20">
          <div className="flex h-10 shrink-0 items-center border-b border-white/[0.04] bg-zinc-950/40 px-6">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">详情</span>
          </div>
          <div className="p-6">
            {!selectedTool ? (
              <EmptyHint title="未选择工具" detail="在左侧列表中点击某个 tool 查看名称、说明与 inputSchema" />
            ) : (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-white">{selectedTool.name}</h2>
                  {selectedTool.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{selectedTool.description}</p>
                  ) : null}
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-zinc-950/30">
                  <button
                    type="button"
                    onClick={() => setInputSchemaOpen((o) => !o)}
                    aria-expanded={inputSchemaOpen}
                    className="flex w-full items-center gap-2 px-1 py-2 text-left transition hover:text-zinc-300"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      aria-hidden
                      className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform duration-200 ${
                        inputSchemaOpen ? 'rotate-90' : ''
                      }`}
                    >
                      <path d="M6 4l4 4-4 4V4z" />
                    </svg>
                    <span className="h-px w-6 shrink-0 bg-zinc-700" aria-hidden />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      inputSchema
                    </span>
                    <span className="text-[10px] font-normal normal-case text-zinc-600">
                      {inputSchemaOpen ? '点击收起' : '点击展开'}
                    </span>
                  </button>
                  {inputSchemaOpen ? (
                    <pre className="mx-1 mb-2 overflow-x-auto rounded-lg border border-white/[0.05] bg-zinc-900/60 p-4 text-xs leading-relaxed text-cyan-100/90 shadow-inner">
                      {JSON.stringify(selectedTool.inputSchema ?? {}, null, 2)}
                    </pre>
                  ) : null}
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-zinc-950/30">
                  <button
                    type="button"
                    onClick={() => setToolTestOpen((o) => !o)}
                    aria-expanded={toolTestOpen}
                    className="flex w-full items-center gap-2 px-1 py-2 text-left transition hover:text-zinc-300"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      aria-hidden
                      className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform duration-200 ${
                        toolTestOpen ? 'rotate-90' : ''
                      }`}
                    >
                      <path d="M6 4l4 4-4 4V4z" />
                    </svg>
                    <span className="h-px w-6 shrink-0 bg-zinc-700" aria-hidden />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      工具测试
                    </span>
                    <span className="text-[10px] font-normal normal-case text-zinc-600">
                      {toolTestOpen ? '点击收起' : '点击展开'}
                    </span>
                  </button>
                  {toolTestOpen ? (
                    <div className="border-t border-white/[0.04] px-1 pb-2 pt-2">
                  <p className="mb-3 text-xs leading-relaxed text-zinc-500">
                    按 <span className="font-mono text-zinc-400">inputSchema</span>（JSON Schema）生成表单，或直接编辑 JSON 作为{' '}
                    <span className="font-mono text-zinc-400">tools/call</span> 的{' '}
                    <span className="font-mono text-zinc-400">arguments</span>。
                  </p>

                  {schemaFields.length > 0 ? (
                    <div
                      className="mb-3 inline-flex rounded-lg border border-white/[0.08] bg-zinc-900/50 p-0.5"
                      role="tablist"
                      aria-label="参数编辑方式"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={argsMode === 'form'}
                        onClick={() => {
                          setArgsParseError(null)
                          try {
                            const parsed: unknown = JSON.parse(toolArgsJson || '{}')
                            if (
                              parsed !== null &&
                              typeof parsed === 'object' &&
                              !Array.isArray(parsed)
                            ) {
                              const obj = parsed as Record<string, unknown>
                              const next = initialFormValues(schemaFields)
                              for (const f of schemaFields) {
                                if (!(f.key in obj)) continue
                                const v = obj[f.key]
                                if (f.kind === 'json') {
                                  next[f.key] = JSON.stringify(v, null, 2)
                                } else if (f.kind === 'boolean') {
                                  if (typeof v === 'boolean') next[f.key] = v ? 'true' : 'false'
                                } else if (f.kind === 'enum') {
                                  const s = String(v)
                                  if (f.enumValues?.some((ev) => String(ev) === s)) next[f.key] = s
                                } else if (f.kind === 'number' || f.kind === 'integer') {
                                  next[f.key] = String(v)
                                } else {
                                  next[f.key] = v == null ? '' : String(v)
                                }
                              }
                              setFormValues(next)
                            }
                          } catch {
                            /* 保留当前表单 */
                          }
                          setArgsMode('form')
                        }}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                          argsMode === 'form'
                            ? 'bg-cyan-500/20 text-cyan-100'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        表单
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={argsMode === 'json'}
                        onClick={() => {
                          setArgsParseError(null)
                          const built = buildArgumentsFromForm(schemaFields, formValues)
                          if (built.ok) {
                            setToolArgsJson(JSON.stringify(built.args, null, 2))
                          }
                          setArgsMode('json')
                        }}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                          argsMode === 'json'
                            ? 'bg-cyan-500/20 text-cyan-100'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        JSON
                      </button>
                    </div>
                  ) : (
                    <p className="mb-2 text-[11px] text-zinc-600">
                      当前工具未声明 <span className="font-mono">properties</span>，请使用 JSON 编辑参数。
                    </p>
                  )}

                  {argsMode === 'form' && schemaFields.length > 0 ? (
                    <div className="mb-3 rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4">
                      <ToolArgsForm fields={schemaFields} values={formValues} onChange={setFormField} />
                    </div>
                  ) : (
                    <textarea
                      value={toolArgsJson}
                      onChange={(e) => {
                        setToolArgsJson(e.target.value)
                        setArgsParseError(null)
                      }}
                      spellCheck={false}
                      rows={6}
                      className="mb-2 w-full resize-y rounded-xl border border-white/[0.08] bg-zinc-900/80 px-3 py-2.5 font-mono text-xs leading-relaxed text-zinc-200 outline-none ring-cyan-500/30 placeholder:text-zinc-600 focus:border-cyan-500/35 focus:ring-2"
                      placeholder='{"query": "..."}'
                      aria-label="工具调用参数 JSON"
                    />
                  )}
                  {argsParseError ? (
                    <p className="mb-2 text-xs text-amber-200/90">{argsParseError}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void runToolTest()}
                    disabled={callLoading || connection !== 'ok' || !selected?.url}
                    className="inline-flex items-center gap-2 rounded-lg border border-teal-500/35 bg-gradient-to-b from-teal-500/15 to-emerald-500/10 px-3 py-2 text-xs font-semibold text-teal-100 transition hover:border-teal-400/45 hover:from-teal-500/25 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {callLoading ? (
                      <>
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal-200/30 border-t-teal-200" />
                        调用中…
                      </>
                    ) : (
                      <>执行 tools/call</>
                    )}
                  </button>
                  {callError ? (
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl border border-red-500/25 bg-red-950/40 p-4 text-xs leading-relaxed text-red-100/95">
                      {callError}
                    </pre>
                  ) : null}
                  {callResult !== null && !callError ? (
                    <div className="mt-3">
                      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        返回结果
                      </div>
                      <pre className="max-h-[min(24rem,50vh)] overflow-auto rounded-xl border border-white/[0.06] bg-zinc-900/60 p-4 text-xs leading-relaxed text-emerald-100/90 shadow-inner">
                        {(() => {
                          try {
                            return JSON.stringify(callResult, null, 2)
                          } catch {
                            return String(callResult)
                          }
                        })()}
                      </pre>
                    </div>
                  ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
