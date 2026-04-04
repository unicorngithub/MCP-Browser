import { useEffect, useState } from 'react'
import type { MCPHttpHeader, MCPServer } from '@shared/types'

type Mode = 'add' | 'edit'

interface HeaderRow {
  id: string
  name: string
  value: string
}

interface ServerDialogProps {
  open: boolean
  mode: Mode
  server: MCPServer | null
  onClose: () => void
  onSave: (name: string, url: string, headers: MCPHttpHeader[]) => Promise<void>
}

function validateUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return '请填写地址'
  try {
    const u = new URL(t)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '仅支持 http / https'
    return null
  } catch {
    return 'URL 格式无效'
  }
}

function rowsToHeaders(rows: HeaderRow[]): MCPHttpHeader[] {
  return rows
    .map((r) => ({ name: r.name.trim(), value: r.value }))
    .filter((r) => r.name.length > 0)
}

function serverToRows(server: MCPServer | null): HeaderRow[] {
  if (!server?.headers?.length) return []
  return server.headers.map((h) => ({
    id: crypto.randomUUID(),
    name: h.name,
    value: h.value,
  }))
}

export function ServerDialog({ open, mode, server, onClose, onSave }: ServerDialogProps) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (mode === 'edit' && server) {
      setName(server.name)
      setUrl(server.url)
      setHeaderRows(serverToRows(server))
    } else {
      setName('')
      setUrl('')
      setHeaderRows([])
    }
  }, [open, mode, server])

  if (!open) return null

  const addHeaderRow = () => {
    setHeaderRows((prev) => [...prev, { id: crypto.randomUUID(), name: '', value: '' }])
  }

  const removeHeaderRow = (id: string) => {
    setHeaderRows((prev) => prev.filter((r) => r.id !== id))
  }

  const updateHeaderRow = (id: string, field: 'name' | 'value', value: string) => {
    setHeaderRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const urlErr = validateUrl(url)
    if (urlErr) {
      setError(urlErr)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(name, url, rowsToHeaders(headerRows))
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm dark:bg-black/60"
      role="presentation"
      onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}
    >
      <div
        className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200/90 bg-white/95 p-6 shadow-lg backdrop-blur-xl dark:border-white/[0.08] dark:bg-zinc-900/95 dark:shadow-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcp-server-dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="mcp-server-dialog-title"
          className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white"
        >
          {mode === 'add' ? '添加 MCP 地址' : '编辑 MCP 地址'}
        </h2>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-500">填写 Streamable HTTP 的 MCP 端点完整 URL</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="text-xs font-medium text-zinc-500">显示名称</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：本地 MCP 服务"
              className="rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-zinc-900 placeholder:text-zinc-400 outline-none ring-cyan-500/30 transition focus:border-cyan-500/60 focus:ring-2 dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-cyan-500/50"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="text-xs font-medium text-zinc-500">HTTP 端点 URL</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/mcp"
              className="rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 outline-none ring-cyan-500/30 transition focus:border-cyan-500/60 focus:ring-2 dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-cyan-500/50"
              autoComplete="off"
            />
          </label>

          <div className="rounded-xl border border-amber-400/35 bg-amber-50/90 px-3 py-2.5 dark:border-amber-500/20 dark:bg-amber-950/25">
            <p className="text-[11px] leading-relaxed text-amber-950 dark:text-amber-100/90">
              <span className="font-medium text-amber-900 dark:text-amber-200">请求头与存储：</span>
              可添加 <span className="font-mono">Authorization</span> 等自定义 Header，会用于该端点的所有 MCP
              请求（含会话删除）。在支持系统凭据库的环境下，请求头值会使用 Electron{' '}
              <span className="font-mono">safeStorage</span> 加密写入本地配置；否则以明文保存。请勿在不受信任的设备上保存高敏感
              Token。
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-500">自定义请求头（可选）</span>
              <button
                type="button"
                onClick={addHeaderRow}
                className="rounded-lg border border-zinc-300 bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-200 dark:border-zinc-600/80 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
              >
                + 添加一行
              </button>
            </div>
            {headerRows.length === 0 ? (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-600">无额外请求头。需要 Bearer Token 时点「添加一行」。</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {headerRows.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-start gap-2 rounded-xl border border-zinc-200/90 bg-zinc-50 p-2 dark:border-white/[0.06] dark:bg-zinc-950/50"
                  >
                    <input
                      value={row.name}
                      onChange={(e) => updateHeaderRow(row.id, 'name', e.target.value)}
                      placeholder="Header 名，如 Authorization"
                      autoComplete="off"
                      className="min-w-[8rem] flex-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 outline-none ring-cyan-500/20 focus:border-cyan-500/50 focus:ring-1 dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-cyan-500/40"
                    />
                    <input
                      value={row.value}
                      onChange={(e) => updateHeaderRow(row.id, 'value', e.target.value)}
                      placeholder="值，如 Bearer …"
                      autoComplete="off"
                      className="min-w-[10rem] flex-[2] rounded-lg border border-zinc-300 bg-white px-2.5 py-2 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 outline-none ring-cyan-500/20 focus:border-cyan-500/50 focus:ring-1 dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-cyan-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => removeHeaderRow(row.id)}
                      className="shrink-0 rounded-lg px-2 py-2 text-xs text-zinc-500 transition hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                      aria-label="移除此请求头"
                    >
                      移除
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error ? (
            <p className="rounded-lg border border-red-300/80 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/20 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          ) : null}
          <div className="mt-2 flex justify-end gap-2 border-t border-zinc-200/90 pt-5 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-cyan-500/15 transition hover:brightness-110 disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
