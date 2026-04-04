import { useTranslation } from 'react-i18next'
import type { MCPServer } from '@shared/types'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useAddressStore } from '@/stores/addressStore'

interface ServerSidebarProps {
  onAdd: () => void
  onEdit: (s: MCPServer) => void
}

export function ServerSidebar({ onAdd, onEdit }: ServerSidebarProps) {
  const { t } = useTranslation()
  const { servers, selectedId, select, removeServer, ready } = useAddressStore()

  return (
    <aside className="flex h-full w-[17.5rem] shrink-0 flex-col border-r border-zinc-200/80 bg-white/70 shadow-[inset_-1px_0_0_rgba(0,0,0,0.04)] backdrop-blur-xl dark:border-white/[0.06] dark:bg-zinc-950/80 dark:shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)]">
      <div className="border-b border-zinc-200/80 px-4 pb-4 pt-2 dark:border-white/[0.06]">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-600 dark:text-cyan-400/90">
            MCP BROWSER
          </div>
          <LanguageSwitcher />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">{t('sidebar.title')}</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">{t('sidebar.subtitle')}</p>
        <button
          type="button"
          onClick={onAdd}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-2.5 text-sm font-medium text-zinc-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 active:scale-[0.98]"
        >
          <span className="text-lg leading-none">+</span>
          {t('sidebar.addAddress')}
        </button>
      </div>

      <div className="px-3 py-3">
        <div className="px-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-600">
          {t('sidebar.saved')}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {!ready ? (
          <div className="mx-1 rounded-xl border border-dashed border-zinc-300 bg-zinc-100/80 px-3 py-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-500">
            {t('sidebar.loadingConfig')}
          </div>
        ) : servers.length === 0 ? (
          <div className="mx-1 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-3 py-8 text-center dark:border-zinc-800 dark:bg-zinc-900/20">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('sidebar.noAddresses')}</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-600">{t('sidebar.noAddressesHint')}</p>
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
                        ? 'border-cyan-500/50 bg-gradient-to-br from-cyan-500/15 to-teal-500/10 shadow-sm dark:border-cyan-500/40 dark:from-cyan-500/10 dark:to-teal-500/5 dark:shadow-panel'
                        : 'border-transparent bg-zinc-100/90 hover:border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900/40 dark:hover:border-zinc-700/80 dark:hover:bg-zinc-900/70'
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
                        <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{s.name}</div>
                        <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">{s.url}</div>
                      </button>
                      <div className="flex shrink-0 flex-col justify-center gap-0.5 border-l border-zinc-200/90 py-1 pr-1 pl-0.5 dark:border-white/[0.04]">
                        <button
                          type="button"
                          title={t('sidebar.editTitle')}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEdit(s)
                          }}
                          className="rounded-md px-2 py-1 text-[11px] text-zinc-600 transition hover:bg-zinc-200/80 hover:text-cyan-600 dark:text-zinc-500 dark:hover:bg-white/5 dark:hover:text-cyan-400"
                        >
                          {t('sidebar.edit')}
                        </button>
                        <button
                          type="button"
                          title={t('sidebar.deleteTitle')}
                          onClick={(e) => {
                            e.stopPropagation()
                            void removeServer(s.id)
                          }}
                          className="rounded-md px-2 py-1 text-[11px] text-zinc-600 transition hover:bg-red-500/10 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                        >
                          {t('sidebar.delete')}
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
