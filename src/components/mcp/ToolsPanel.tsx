import { useMemo, useState, useCallback, useEffect, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { McpConnectDiagnostics, McpConnectStep } from '@shared/types'
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
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-200/90 text-xl text-zinc-500 dark:bg-zinc-800/80">
        ◇
      </div>
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-400">{title}</p>
      {detail ? (
        <p className="mt-2 max-w-xs text-xs leading-relaxed text-zinc-500 dark:text-zinc-600">{detail}</p>
      ) : null}
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

const STEP_LABEL_KEYS: Record<McpConnectStep, string> = {
  initialize: 'tools.stepInitialize',
  'notifications/initialized': 'tools.stepNotificationsInitialized',
  'tools/list': 'tools.stepToolsList',
  'tools/call': 'tools.stepToolsCall',
}

function mcpSessionIdHint(
  step: McpConnectStep,
  had: boolean,
  tr: (key: string) => string,
): string {
  if (step === 'initialize') {
    return had ? tr('tools.diagInitWithSession') : tr('tools.diagInitNoSession')
  }
  return had ? tr('tools.diagStepWithSession') : tr('tools.diagStepNoSession')
}

function McpConnectDiagnosticsBlock({ d }: { d: McpConnectDiagnostics }) {
  const { t } = useTranslation()
  return (
    <div className="mt-3 border-t border-red-300/50 pt-3 text-[11px] leading-relaxed text-red-900 dark:border-red-500/20 dark:text-red-100/85">
      <div className="mb-1.5 font-semibold uppercase tracking-wider text-red-700 dark:text-red-300/90">
        {t('tools.diagTitle')}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono">
        <dt className="text-red-700 dark:text-red-400/90">{t('tools.diagFailStep')}</dt>
        <dd>{t(STEP_LABEL_KEYS[d.step])}</dd>
        <dt className="text-red-700 dark:text-red-400/90">{t('tools.diagHttpStatus')}</dt>
        <dd>{d.httpStatus === null ? t('tools.diagHttpNoResponse') : d.httpStatus}</dd>
        <dt className="text-red-700 dark:text-red-400/90">{t('tools.diagSessionId')}</dt>
        <dd>{mcpSessionIdHint(d.step, d.hadSessionId, t)}</dd>
        <dt className="text-red-700 dark:text-red-400/90">{t('tools.diagDetail')}</dt>
        <dd className="whitespace-pre-wrap break-all text-red-950 dark:text-red-50/90">{d.detail}</dd>
      </dl>
    </div>
  )
}

export function ToolsPanel() {
  const { t } = useTranslation()
  const { servers, selectedId } = useAddressStore()
  const selected = useMemo(
    () => servers.find((s) => s.id === selectedId) ?? null,
    [servers, selectedId],
  )

  const {
    tools,
    connection,
    error,
    connectDiagnostics,
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
  const [callDiagnostics, setCallDiagnostics] = useState<McpConnectDiagnostics | null>(null)
  const [callResult, setCallResult] = useState<unknown>(null)
  const [inputSchemaOpen, setInputSchemaOpen] = useState(true)
  const [toolTestOpen, setToolTestOpen] = useState(true)
  const [toolListQuery, setToolListQuery] = useState('')
  const [toolListSearchField, setToolListSearchField] = useState<'name' | 'description' | 'both'>(
    'name',
  )

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
    setCallDiagnostics(null)
    setCallResult(null)
    setInputSchemaOpen(true)
    setToolTestOpen(true)
  }, [selectedToolName, schemaFields])

  useEffect(() => {
    setToolListQuery('')
    setToolListSearchField('name')
  }, [selectedId])

  const filteredTools = useMemo(() => {
    const q = toolListQuery.trim().toLowerCase()
    if (!q) return tools
    return tools.filter((t) => {
      const inName = t.name.toLowerCase().includes(q)
      if (toolListSearchField === 'name') return inName
      const d = t.description?.toLowerCase() ?? ''
      const inDesc = d.includes(q)
      if (toolListSearchField === 'description') return inDesc
      return inName || inDesc
    })
  }, [tools, toolListQuery, toolListSearchField])

  const toolsListToRender = useMemo(() => {
    const selected = tools.find((t) => t.name === selectedToolName)
    if (!selected) return filteredTools
    if (filteredTools.some((t) => t.name === selectedToolName)) return filteredTools
    return [selected, ...filteredTools]
  }, [tools, filteredTools, selectedToolName])

  const setFormField = useCallback((key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const runToolTest = useCallback(async () => {
    if (!selected?.url || !selectedTool) return
    let args: Record<string, unknown>
    if (argsMode === 'form' && schemaFields.length > 0) {
      const built = buildArgumentsFromForm(schemaFields, formValues)
      if (!built.ok) {
        setArgsParseError(t(`tools.formErrors.${built.error.kind}`, { field: built.error.field }))
        return
      }
      args = built.args
    } else {
      try {
        const parsed: unknown = JSON.parse(toolArgsJson || '{}')
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setArgsParseError(t('tools.argsRootObject'))
          return
        }
        args = parsed as Record<string, unknown>
      } catch {
        setArgsParseError(t('tools.argsInvalidJson'))
        return
      }
    }
    setArgsParseError(null)
    setCallError(null)
    setCallDiagnostics(null)
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
        setCallDiagnostics(out.diagnostics ?? null)
        return
      }
      setCallResult(out.result)
    } catch (e) {
      setCallError(e instanceof Error ? e.message : String(e))
      setCallDiagnostics(null)
    } finally {
      setCallLoading(false)
    }
  }, [selected?.url, selected?.headers, selectedTool, toolArgsJson, argsMode, schemaFields, formValues, t])

  const statusLabel =
    connection === 'idle'
      ? t('tools.statusIdle')
      : connection === 'loading'
        ? t('tools.statusLoading')
        : connection === 'ok'
          ? t('tools.statusOk')
          : t('tools.statusError')

  const statusDot =
    connection === 'ok'
      ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.45)]'
      : connection === 'error'
        ? 'bg-red-400'
        : connection === 'loading'
          ? 'animate-pulse bg-amber-400'
          : 'bg-zinc-400 dark:bg-zinc-500'

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
    <main className="flex min-w-0 flex-1 flex-col bg-zinc-100/90 dark:bg-zinc-950/40">
      {/* 主工具栏 */}
      <header className="flex min-h-[3.25rem] shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-200/90 bg-gradient-to-b from-white/90 to-zinc-100/95 px-4 py-2.5 backdrop-blur-md dark:border-white/[0.06] dark:from-zinc-900/50 dark:to-zinc-950/80 sm:px-5">
        <div className="min-w-0 flex-1 basis-[min(100%,14rem)]">
          <h1
            data-testid="mcp-tools-header"
            className="truncate text-base font-semibold leading-tight tracking-tight text-zinc-900 dark:text-white sm:text-lg"
          >
            {selected ? selected.name : t('tools.selectService')}
          </h1>
          {selected ? (
            <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500 sm:text-xs" title={selected.url}>
              {selected.url}
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-zinc-500 sm:text-xs dark:text-zinc-600">
              {t('tools.selectAddressHint')}
            </p>
          )}
        </div>

        <div
          className="flex flex-wrap items-center gap-2 sm:gap-1.5"
          role="toolbar"
          aria-label={t('tools.toolbarAria')}
        >
          {showToolCount ? (
            <span
              className="order-first rounded-md border border-cyan-500/35 bg-cyan-500/10 px-2 py-1 text-[11px] font-medium tabular-nums text-cyan-800 dark:border-cyan-500/20 dark:text-cyan-200/90 sm:order-none"
              title={t('tools.toolCountTitle')}
            >
              {t('tools.toolCount', { count: tools.length })}
            </span>
          ) : null}

          <div
            className="hidden h-7 w-px bg-zinc-300/90 dark:bg-white/[0.08] sm:block"
            aria-hidden
            role="separator"
          />

          <div
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200/90 bg-white/80 px-2.5 py-1.5 dark:border-white/[0.08] dark:bg-zinc-950/60 sm:px-3"
            title={t('tools.connectionStatus')}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot}`} aria-hidden />
            <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{statusLabel}</span>
          </div>

          <div
            className="hidden h-7 w-px bg-zinc-300/90 dark:bg-white/[0.08] sm:block"
            aria-hidden
            role="separator"
          />

          <div className="flex items-center gap-1.5">
            {selected?.url ? (
              <button
                type="button"
                onClick={() => void copyUrl()}
                title={t('tools.copyUrlTitle')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700/90 dark:bg-zinc-900/70 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                <ToolbarIcon>
                  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="h-3.5 w-3.5 opacity-80">
                    <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2v2a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V2zm0 2v2h6a2 2 0 0 1 2 2v6h2V2H4zm2 4H2v8h8V8H6z" />
                  </svg>
                </ToolbarIcon>
                <span className="hidden sm:inline">{copyDone ? t('tools.copied') : t('tools.copyUrl')}</span>
                <span className="sm:hidden">{copyDone ? '✓' : t('tools.copyShort')}</span>
              </button>
            ) : null}

            {selected ? (
              <button
                type="button"
                onClick={retry}
                disabled={connection === 'loading'}
                title={
                  connection === 'loading' ? t('tools.refreshLoadingTitle') : t('tools.refreshIdleTitle')
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-600/35 bg-gradient-to-b from-cyan-100/90 to-teal-50/80 px-2.5 py-1.5 text-xs font-semibold text-cyan-900 transition hover:border-cyan-500/50 hover:from-cyan-100 hover:to-teal-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-cyan-500/30 dark:from-cyan-500/15 dark:to-teal-500/10 dark:text-cyan-100 dark:hover:border-cyan-400/50 dark:hover:from-cyan-500/25 dark:hover:to-teal-500/15"
              >
                <ToolbarIcon className={connection === 'loading' ? 'animate-spin' : ''}>
                  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="h-3.5 w-3.5">
                    <path d="M8 0a8 8 0 1 0 8 8h-2A6 6 0 1 1 8 2V0z" />
                  </svg>
                </ToolbarIcon>
                {connection === 'loading' ? t('tools.refreshLoading') : t('tools.refresh')}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {connection === 'error' && error ? (
        <div className="mx-4 mt-3 rounded-xl border border-red-300/80 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-md sm:mx-5 dark:border-red-500/25 dark:bg-red-950/35 dark:text-red-200/95 dark:shadow-lg dark:shadow-red-900/20">
          <div className="whitespace-pre-wrap">{error}</div>
          {connectDiagnostics ? <McpConnectDiagnosticsBlock d={connectDiagnostics} /> : null}
        </div>
      ) : null}

      {connection === 'error' ? (
        <div className="min-h-0 flex-1 bg-zinc-100/90 dark:bg-zinc-950/40" aria-hidden />
      ) : (
        <div className="flex min-h-0 flex-1">
          <section className="flex w-[min(100%,24rem)] shrink-0 flex-col border-r border-zinc-200/90 bg-white/50 dark:border-white/[0.06] dark:bg-zinc-950/30">
            <div className="flex h-10 shrink-0 items-center border-b border-zinc-200/80 bg-zinc-50/90 px-4 dark:border-white/[0.04] dark:bg-zinc-950/40">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {t('tools.sectionTools')}
              </span>
              {connection === 'ok' && tools.length > 0 ? (
                <span
                  className="ml-2 rounded bg-zinc-200/90 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-400"
                  title={
                    toolListQuery.trim()
                      ? t('tools.filterCountTitle', { total: tools.length })
                      : t('tools.totalCountTitle')
                  }
                >
                  {toolListQuery.trim() ? `${filteredTools.length}/${tools.length}` : tools.length}
                </span>
              ) : null}
            </div>
            {connection === 'ok' && tools.length > 0 ? (
            <div className="shrink-0 border-b border-zinc-200/80 px-3 py-2 dark:border-white/[0.04]">
              <div className="flex min-w-0 items-center gap-2">
                <label className="sr-only" htmlFor="mcp-tool-list-filter">
                  {t('tools.searchLabel')}
                </label>
                <input
                  id="mcp-tool-list-filter"
                  type="search"
                  value={toolListQuery}
                  onChange={(e) => setToolListQuery(e.target.value)}
                  placeholder={
                    toolListSearchField === 'name'
                      ? t('tools.searchPlaceholderName')
                      : toolListSearchField === 'description'
                        ? t('tools.searchPlaceholderDesc')
                        : t('tools.searchPlaceholderBoth')
                  }
                  autoComplete="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 outline-none ring-cyan-500/25 placeholder:text-zinc-400 focus:border-cyan-500/50 focus:ring-2 dark:border-white/[0.08] dark:bg-zinc-900/70 dark:text-zinc-200 dark:placeholder:text-zinc-600 dark:focus:border-cyan-500/35"
                />
                <label className="sr-only" htmlFor="mcp-tool-list-field">
                  {t('tools.fieldLabel')}
                </label>
                <select
                  id="mcp-tool-list-field"
                  value={toolListSearchField}
                  onChange={(e) =>
                    setToolListSearchField(e.target.value as 'name' | 'description' | 'both')
                  }
                  title={t('tools.fieldTitle')}
                  className="shrink-0 cursor-pointer rounded-lg border border-zinc-300 bg-white py-2 pl-2 pr-7 text-[11px] font-medium text-zinc-800 outline-none ring-cyan-500/25 focus:border-cyan-500/50 focus:ring-2 dark:border-white/[0.08] dark:bg-zinc-900/70 dark:text-zinc-200 dark:focus:border-cyan-500/35"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2371717a' d='M3 4.5L6 7.5L9 4.5'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.4rem center',
                    appearance: 'none',
                  }}
                >
                  <option value="name">{t('tools.optionName')}</option>
                  <option value="description">{t('tools.optionDescription')}</option>
                  <option value="both">{t('tools.optionBoth')}</option>
                </select>
              </div>
            </div>
          ) : null}
            <div className="flex-1 overflow-y-auto p-3">
            {connection === 'loading' ? (
              <EmptyHint title={t('tools.emptyFetching')} detail={t('tools.emptyFetchingDetail')} />
            ) : !selected ? (
              <EmptyHint title={t('tools.emptyNoService')} detail={t('tools.emptyNoServiceDetail')} />
            ) : connection === 'ok' && tools.length === 0 ? (
              <EmptyHint title={t('tools.emptyNoTools')} detail={t('tools.emptyNoToolsDetail')} />
            ) : connection === 'ok' ? (
              filteredTools.length === 0 ? (
                <EmptyHint
                  title={t('tools.emptyNoMatch')}
                  detail={toolListQuery.trim() ? t('tools.emptyNoMatchDetail') : undefined}
                />
              ) : (
                <ul data-testid="mcp-tool-list" className="flex flex-col gap-2">
                  {toolsListToRender.map((tool) => {
                    const on = tool.name === selectedToolName
                    const pinned =
                      toolListQuery.trim() &&
                      selectedToolName === tool.name &&
                      !filteredTools.some((x) => x.name === tool.name)
                    return (
                      <li key={tool.name}>
                        <button
                          type="button"
                          onClick={() => setSelectedTool(tool.name)}
                          className={`w-full rounded-xl border px-3.5 py-3 text-left transition-all ${
                            on
                              ? 'border-cyan-500/45 bg-gradient-to-br from-cyan-500/15 to-transparent shadow-sm dark:border-cyan-500/35 dark:from-cyan-500/10 dark:shadow-panel'
                              : 'border-transparent bg-zinc-100/90 hover:border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900'
                          }`}
                        >
                          {pinned ? (
                            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-600">
                              {t('tools.pinned')}
                            </div>
                          ) : null}
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">{tool.name}</div>
                          {tool.description ? (
                            <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
                              {tool.description}
                            </div>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )
            ) : null}
            </div>
          </section>

          <section className="min-w-0 flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950/20">
          <div className="flex h-10 shrink-0 items-center border-b border-zinc-200/80 bg-zinc-50/90 px-6 dark:border-white/[0.04] dark:bg-zinc-950/40">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-600">
              {t('tools.detailSection')}
            </span>
          </div>
          <div className="p-6">
            {!selectedTool ? (
              <EmptyHint title={t('tools.emptyNoTool')} detail={t('tools.emptyNoToolDetail')} />
            ) : (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                    {selectedTool.name}
                  </h2>
                  {selectedTool.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {selectedTool.description}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-xl border border-zinc-200/90 bg-white/60 dark:border-white/[0.06] dark:bg-zinc-950/30">
                  <button
                    type="button"
                    onClick={() => setInputSchemaOpen((o) => !o)}
                    aria-expanded={inputSchemaOpen}
                    className="flex w-full items-center gap-2 px-1 py-2 text-left transition hover:text-zinc-800 dark:hover:text-zinc-300"
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
                    <span className="h-px w-6 shrink-0 bg-zinc-300 dark:bg-zinc-700" aria-hidden />
                    <span className="text-[11px] font-semibold normal-case tracking-wide text-zinc-500">
                      {t('tools.inputSchemaSection')}
                    </span>
                    <span className="text-[10px] font-normal normal-case text-zinc-500 dark:text-zinc-600">
                      {inputSchemaOpen ? t('tools.schemaToggleCollapse') : t('tools.schemaToggleExpand')}
                    </span>
                  </button>
                  {inputSchemaOpen ? (
                    <pre className="mx-1 mb-2 overflow-x-auto rounded-lg border border-zinc-200/80 bg-zinc-100/90 p-4 text-xs leading-relaxed text-cyan-900 shadow-inner dark:border-white/[0.05] dark:bg-zinc-900/60 dark:text-cyan-100/90">
                      {JSON.stringify(selectedTool.inputSchema ?? {}, null, 2)}
                    </pre>
                  ) : null}
                </div>

                <div className="rounded-xl border border-zinc-200/90 bg-white/60 dark:border-white/[0.06] dark:bg-zinc-950/30">
                  <button
                    type="button"
                    onClick={() => setToolTestOpen((o) => !o)}
                    aria-expanded={toolTestOpen}
                    className="flex w-full items-center gap-2 px-1 py-2 text-left transition hover:text-zinc-800 dark:hover:text-zinc-300"
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
                    <span className="h-px w-6 shrink-0 bg-zinc-300 dark:bg-zinc-700" aria-hidden />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      {t('tools.toolTest')}
                    </span>
                    <span className="text-[10px] font-normal normal-case text-zinc-500 dark:text-zinc-600">
                      {toolTestOpen ? t('tools.schemaToggleCollapse') : t('tools.schemaToggleExpand')}
                    </span>
                  </button>
                  {toolTestOpen ? (
                    <div className="border-t border-zinc-200/80 px-1 pb-2 pt-2 dark:border-white/[0.04]">
                  <p className="mb-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
                    <Trans
                      i18nKey="tools.toolTestHint"
                      components={{
                        schema: <span className="font-mono text-zinc-700 dark:text-zinc-400" />,
                        call: <span className="font-mono text-zinc-700 dark:text-zinc-400" />,
                        args: <span className="font-mono text-zinc-700 dark:text-zinc-400" />,
                      }}
                    />
                  </p>

                  {schemaFields.length > 0 ? (
                    <div
                      className="mb-3 inline-flex rounded-lg border border-zinc-200/90 bg-zinc-100/80 p-0.5 dark:border-white/[0.08] dark:bg-zinc-900/50"
                      role="tablist"
                      aria-label={t('tools.argsModeAria')}
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
                            ? 'bg-cyan-500/25 text-cyan-900 dark:bg-cyan-500/20 dark:text-cyan-100'
                            : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-300'
                        }`}
                      >
                        {t('tools.formMode')}
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
                            ? 'bg-cyan-500/25 text-cyan-900 dark:bg-cyan-500/20 dark:text-cyan-100'
                            : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-300'
                        }`}
                      >
                        {t('tools.jsonMode')}
                      </button>
                    </div>
                  ) : (
                    <p className="mb-2 text-[11px] text-zinc-500 dark:text-zinc-600">
                      <Trans
                        i18nKey="tools.noPropertiesHint"
                        components={{ p: <span className="font-mono" /> }}
                      />
                    </p>
                  )}

                  {argsMode === 'form' && schemaFields.length > 0 ? (
                    <div className="mb-3 rounded-xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/[0.06] dark:bg-zinc-900/40">
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
                      className="mb-2 w-full resize-y rounded-xl border border-zinc-300 bg-white px-3 py-2.5 font-mono text-xs leading-relaxed text-zinc-900 outline-none ring-cyan-500/30 placeholder:text-zinc-400 focus:border-cyan-500/50 focus:ring-2 dark:border-white/[0.08] dark:bg-zinc-900/80 dark:text-zinc-200 dark:placeholder:text-zinc-600 dark:focus:border-cyan-500/35"
                      placeholder='{"query": "..."}'
                      aria-label={t('tools.argsJsonAria')}
                    />
                  )}
                  {argsParseError ? (
                    <p className="mb-2 text-xs text-amber-800 dark:text-amber-200/90">{argsParseError}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void runToolTest()}
                    disabled={callLoading || connection !== 'ok' || !selected?.url}
                    className="inline-flex items-center gap-2 rounded-lg border border-teal-600/40 bg-gradient-to-b from-teal-100/90 to-emerald-50/80 px-3 py-2 text-xs font-semibold text-teal-900 transition hover:border-teal-500/50 hover:from-teal-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-teal-500/35 dark:from-teal-500/15 dark:to-emerald-500/10 dark:text-teal-100 dark:hover:border-teal-400/45 dark:hover:from-teal-500/25"
                  >
                    {callLoading ? (
                      <>
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal-600/40 border-t-teal-700 dark:border-teal-200/30 dark:border-t-teal-200" />
                        {t('tools.callRunning')}
                      </>
                    ) : (
                      <>{t('tools.callButton')}</>
                    )}
                  </button>
                  {callError ? (
                    <div className="mt-3 rounded-xl border border-red-300/80 bg-red-50 p-4 text-xs leading-relaxed text-red-900 dark:border-red-500/25 dark:bg-red-950/40 dark:text-red-100/95">
                      <pre className="overflow-x-auto whitespace-pre-wrap">{callError}</pre>
                      {callDiagnostics ? <McpConnectDiagnosticsBlock d={callDiagnostics} /> : null}
                    </div>
                  ) : null}
                  {callResult !== null && !callError ? (
                    <div className="mt-3">
                      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        {t('tools.resultTitle')}
                      </div>
                      <pre className="max-h-[min(24rem,50vh)] overflow-auto rounded-xl border border-zinc-200/90 bg-emerald-50/80 p-4 text-xs leading-relaxed text-emerald-950 shadow-inner dark:border-white/[0.06] dark:bg-zinc-900/60 dark:text-emerald-100/90">
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
      )}
    </main>
  )
}
