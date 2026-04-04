import { useState, useCallback, useEffect } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { MCP_IPC_USER_CANCELLED } from '@shared/mcpIpc'
import type { MCPServer } from '@shared/types'
import { useAddressStore } from '@/stores/addressStore'

export function McpServersImportExport() {
  const { t } = useTranslation()
  const servers = useAddressStore((s) => s.servers)
  const replaceAllServers = useAddressStore((s) => s.replaceAllServers)

  const [exportOpen, setExportOpen] = useState(false)
  const [redactHeaders, setRedactHeaders] = useState(true)
  const [importCandidates, setImportCandidates] = useState<MCPServer[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 4500)
  }, [])

  const runExport = useCallback(async () => {
    setBusy(true)
    try {
      const r = await window.mcpDesktop.exportServersJson({ redactHeaders })
      if (r.ok) {
        setExportOpen(false)
        showToast(t('importExport.toastSaved'))
      } else if (r.error !== MCP_IPC_USER_CANCELLED) {
        showToast(r.error)
      }
    } finally {
      setBusy(false)
    }
  }, [redactHeaders, showToast, t])

  const pickImportFile = useCallback(async () => {
    setBusy(true)
    try {
      const r = await window.mcpDesktop.importServersJson()
      if (!r.ok) {
        if (r.error !== MCP_IPC_USER_CANCELLED) showToast(r.error)
        return
      }
      setImportCandidates(r.servers)
    } finally {
      setBusy(false)
    }
  }, [showToast])

  useEffect(() => {
    return window.mcpDesktop.onServersBackupMenuAction((action) => {
      if (action === 'export') setExportOpen(true)
      else void pickImportFile()
    })
  }, [pickImportFile])

  const applyImport = useCallback(async () => {
    if (!importCandidates?.length) return
    setBusy(true)
    try {
      await replaceAllServers(importCandidates)
      const n = importCandidates.length
      setImportCandidates(null)
      showToast(t('importExport.toastImported', { count: n }))
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [importCandidates, replaceAllServers, showToast, t])

  return (
    <>
      {toast ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[70] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 px-4">
          <p className="rounded-xl border border-cyan-500/30 bg-white/95 px-3 py-2 text-center text-xs text-cyan-800 shadow-lg backdrop-blur-xl dark:border-cyan-500/25 dark:bg-zinc-900/95 dark:text-cyan-200/95">
            {toast}
          </p>
        </div>
      ) : null}

      {exportOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm dark:bg-black/60"
          role="presentation"
          onMouseDown={(ev) => ev.target === ev.currentTarget && !busy && setExportOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-200/90 bg-white/95 p-5 shadow-lg backdrop-blur-xl dark:border-white/[0.08] dark:bg-zinc-900/95 dark:shadow-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mcp-export-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="mcp-export-title" className="text-base font-semibold text-zinc-900 dark:text-white">
              {t('importExport.exportTitle')}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-amber-900 dark:text-amber-200/85">
              {t('importExport.exportWarning')}
            </p>
            <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={redactHeaders}
                onChange={(e) => setRedactHeaders(e.target.checked)}
                className="mt-0.5 rounded border-zinc-400 dark:border-zinc-600"
              />
              <span>
                <Trans
                  i18nKey="importExport.redactNotice"
                  components={{
                    v: <span className="font-mono text-xs" />,
                    s: <span className="font-mono text-xs" />,
                  }}
                />
              </span>
            </label>
            <div className="mt-5 flex justify-end gap-2 border-t border-zinc-200/90 pt-4 dark:border-white/[0.06]">
              <button
                type="button"
                disabled={busy}
                onClick={() => setExportOpen(false)}
                className="rounded-xl px-4 py-2 text-sm text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5"
              >
                {t('importExport.cancel')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runExport()}
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
              >
                {busy ? t('importExport.busy') : t('importExport.choosePath')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importCandidates ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm dark:bg-black/60"
          role="presentation"
          onMouseDown={(ev) => ev.target === ev.currentTarget && !busy && setImportCandidates(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-200/90 bg-white/95 p-5 shadow-lg backdrop-blur-xl dark:border-white/[0.08] dark:bg-zinc-900/95 dark:shadow-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mcp-import-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="mcp-import-title" className="text-base font-semibold text-zinc-900 dark:text-white">
              {t('importExport.importTitle')}
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              <Trans
                i18nKey="importExport.importBody"
                values={{ fileCount: importCandidates.length, currentCount: servers.length }}
                components={{
                  fc: <span className="font-mono text-cyan-700 dark:text-cyan-300/90" />,
                  strong: <strong className="text-amber-800 dark:text-amber-200/90" />,
                  cc: <span className="font-mono text-zinc-700 dark:text-zinc-300" />,
                }}
              />
            </p>
            <div className="mt-5 flex justify-end gap-2 border-t border-zinc-200/90 pt-4 dark:border-white/[0.06]">
              <button
                type="button"
                disabled={busy}
                onClick={() => setImportCandidates(null)}
                className="rounded-xl px-4 py-2 text-sm text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5"
              >
                {t('importExport.cancel')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void applyImport()}
                className="rounded-xl border border-amber-500/50 bg-amber-100/80 px-4 py-2 text-sm font-semibold text-amber-950 disabled:opacity-50 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100"
              >
                {busy ? t('importExport.busy') : t('importExport.confirmReplace')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
