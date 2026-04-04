import { useState, useCallback, useEffect } from 'react'
import type { MCPServer } from '@shared/types'
import { useAddressStore } from '@/stores/addressStore'

export function McpServersImportExport() {
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
        showToast('已保存 JSON 文件')
      } else if (r.error !== '已取消') {
        showToast(r.error)
      }
    } finally {
      setBusy(false)
    }
  }, [redactHeaders, showToast])

  const pickImportFile = useCallback(async () => {
    setBusy(true)
    try {
      const r = await window.mcpDesktop.importServersJson()
      if (!r.ok) {
        if (r.error !== '已取消') showToast(r.error)
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
      showToast(`已导入并替换为 ${n} 条地址`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [importCandidates, replaceAllServers, showToast])

  return (
    <>
      {toast ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[70] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 px-4">
          <p className="rounded-xl border border-cyan-500/25 bg-zinc-900/95 px-3 py-2 text-center text-xs text-cyan-200/95 shadow-lg backdrop-blur-xl">
            {toast}
          </p>
        </div>
      ) : null}

      {exportOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(ev) => ev.target === ev.currentTarget && !busy && setExportOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-zinc-900/95 p-5 shadow-dialog backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mcp-export-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="mcp-export-title" className="text-base font-semibold text-white">
              导出 MCP 地址配置
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-amber-200/85">
              文件中包含完整 URL 与自定义请求头（如 Token）。请妥善保管，勿提交到公开仓库。
            </p>
            <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={redactHeaders}
                onChange={(e) => setRedactHeaders(e.target.checked)}
                className="mt-0.5 rounded border-zinc-600"
              />
              <span>
                将请求头的 <span className="font-mono text-xs">value</span> 导出为{' '}
                <span className="font-mono text-xs">***</span>（仍保留名称，便于换机后手工填写）
              </span>
            </label>
            <div className="mt-5 flex justify-end gap-2 border-t border-white/[0.06] pt-4">
              <button
                type="button"
                disabled={busy}
                onClick={() => setExportOpen(false)}
                className="rounded-xl px-4 py-2 text-sm text-zinc-400 transition hover:bg-white/5"
              >
                取消
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runExport()}
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
              >
                {busy ? '…' : '选择保存位置'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importCandidates ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(ev) => ev.target === ev.currentTarget && !busy && setImportCandidates(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-zinc-900/95 p-5 shadow-dialog backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mcp-import-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="mcp-import-title" className="text-base font-semibold text-white">
              确认导入
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              将用文件中的 <span className="font-mono text-cyan-300/90">{importCandidates.length}</span>{' '}
              条地址<strong className="text-amber-200/90"> 完全替换 </strong>
              当前已保存的 <span className="font-mono text-zinc-300">{servers.length}</span> 条（不可撤销合并）。
            </p>
            <div className="mt-5 flex justify-end gap-2 border-t border-white/[0.06] pt-4">
              <button
                type="button"
                disabled={busy}
                onClick={() => setImportCandidates(null)}
                className="rounded-xl px-4 py-2 text-sm text-zinc-400 transition hover:bg-white/5"
              >
                取消
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void applyImport()}
                className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
              >
                {busy ? '…' : '确认替换'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
