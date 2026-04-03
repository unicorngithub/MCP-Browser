import type { MCPServer } from '@shared/types'
import { useAddressStore } from '@/stores/addressStore'

interface ServerSidebarProps {
  onAdd: () => void
  onEdit: (s: MCPServer) => void
}

export function ServerSidebar({ onAdd, onEdit }: ServerSidebarProps) {
  const { servers, selectedId, select, removeServer, ready } = useAddressStore()

  return (
    <aside className="flex h-full w-[17.5rem] shrink-0 flex-col border-r border-white/[0.06] bg-zinc-950/80 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
      <div className="border-b border-white/[0.06] px-4 pb-4 pt-5">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-400/90">
          MCP BROWSER
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-white">端点与工具</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">管理 MCP HTTP 端点与 tools 列表</p>
        <button
          type="button"
          onClick={onAdd}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-2.5 text-sm font-medium text-zinc-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 active:scale-[0.98]"
        >
          <span className="text-lg leading-none">+</span>
          添加地址
        </button>
      </div>

      <div className="px-3 py-3">
        <div className="px-1 text-[11px] font-medium uppercase tracking-wider text-zinc-600">已保存</div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {!ready ? (
          <div className="mx-1 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 px-3 py-8 text-center text-sm text-zinc-500">
            正在读取配置…
          </div>
        ) : servers.length === 0 ? (
          <div className="mx-1 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 px-3 py-8 text-center">
            <p className="text-sm text-zinc-400">还没有 MCP 地址</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">点击上方按钮添加服务端 URL</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {servers.map((s) => {
              const active = s.id === selectedId
              return (
                <li key={s.id}>
                  <div
                    className={`group relative overflow-hidden rounded-xl border transition-all ${
                      active
                        ? 'border-cyan-500/40 bg-gradient-to-br from-cyan-500/10 to-teal-500/5 shadow-panel'
                        : 'border-transparent bg-zinc-900/40 hover:border-zinc-700/80 hover:bg-zinc-900/70'
                    }`}
                  >
                    {active ? (
                      <div
                        className="absolute left-0 top-0 h-full w-0.5 bg-gradient-to-b from-cyan-400 to-teal-500"
                        aria-hidden
                      />
                    ) : null}
                    <div className="flex min-w-0">
                      <button
                        type="button"
                        onClick={() => select(s.id)}
                        className="min-w-0 flex-1 px-3 py-2.5 text-left"
                      >
                        <div className="truncate text-sm font-medium text-zinc-100">{s.name}</div>
                        <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">{s.url}</div>
                      </button>
                      <div className="flex shrink-0 flex-col justify-center gap-0.5 border-l border-white/[0.04] py-1 pr-1 pl-0.5">
                        <button
                          type="button"
                          title="编辑"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEdit(s)
                          }}
                          className="rounded-md px-2 py-1 text-[11px] text-zinc-500 transition hover:bg-white/5 hover:text-cyan-400"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          title="删除"
                          onClick={(e) => {
                            e.stopPropagation()
                            void removeServer(s.id)
                          }}
                          className="rounded-md px-2 py-1 text-[11px] text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
