import { useEffect, useState } from 'react'
import type { MCPServer } from '@shared/types'

type Mode = 'add' | 'edit'

interface ServerDialogProps {
  open: boolean
  mode: Mode
  server: MCPServer | null
  onClose: () => void
  onSave: (name: string, url: string) => Promise<void>
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

export function ServerDialog({ open, mode, server, onClose, onSave }: ServerDialogProps) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (mode === 'edit' && server) {
      setName(server.name)
      setUrl(server.url)
    } else {
      setName('')
      setUrl('')
    }
  }, [open, mode, server])

  if (!open) return null

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
      await onSave(name, url)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-zinc-900/95 p-6 shadow-dialog backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcp-server-dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="mcp-server-dialog-title"
          className="text-lg font-semibold tracking-tight text-white"
        >
          {mode === 'add' ? '添加 MCP 地址' : '编辑 MCP 地址'}
        </h2>
        <p className="mt-1 text-xs text-zinc-500">填写 Streamable HTTP 的 MCP 端点完整 URL</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
            <span className="text-xs font-medium text-zinc-500">显示名称</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：本地 MCP 服务"
              className="rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-3.5 py-2.5 text-zinc-100 placeholder:text-zinc-600 outline-none ring-cyan-500/30 transition focus:border-cyan-500/50 focus:ring-2"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
            <span className="text-xs font-medium text-zinc-500">HTTP 端点 URL</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/mcp"
              className="rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-3.5 py-2.5 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 outline-none ring-cyan-500/30 transition focus:border-cyan-500/50 focus:ring-2"
              autoComplete="off"
            />
          </label>
          {error ? (
            <p className="rounded-lg border border-red-500/20 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}
          <div className="mt-2 flex justify-end gap-2 border-t border-white/[0.06] pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
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
