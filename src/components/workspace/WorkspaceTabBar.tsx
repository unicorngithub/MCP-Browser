import { useTranslation } from 'react-i18next'
import { useWorkspaceUiStore } from '@/stores/workspaceUiStore'

export function WorkspaceTabBar() {
  const { t } = useTranslation()
  const workspaceOrder = useWorkspaceUiStore((s) => s.workspaceOrder)
  const activeWorkspaceId = useWorkspaceUiStore((s) => s.activeWorkspaceId)
  const setActiveWorkspace = useWorkspaceUiStore((s) => s.setActiveWorkspace)
  const addWorkspaceCloneOfActive = useWorkspaceUiStore((s) => s.addWorkspaceCloneOfActive)
  const removeWorkspace = useWorkspaceUiStore((s) => s.removeWorkspace)
  const canCloseTab = workspaceOrder.length > 1

  return (
    <div
      className="flex shrink-0 items-center gap-1 border-b border-zinc-200/80 bg-white/80 px-2 py-1.5 backdrop-blur-md dark:border-white/[0.06] dark:bg-zinc-950/85"
      role="tablist"
      aria-label={t('workspace.tabListAria')}
    >
      {workspaceOrder.map((id, i) => {
        const active = id === activeWorkspaceId
        return (
          <div
            key={id}
            role="tab"
            aria-selected={active}
            className={`flex max-w-[11rem] items-center gap-0.5 rounded-lg pl-2 pr-0.5 transition ${
              active
                ? 'bg-cyan-500/15 text-cyan-900 shadow-sm dark:bg-cyan-500/20 dark:text-cyan-100'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/80'
            }`}
          >
            <button
              type="button"
              className="min-w-0 flex-1 truncate py-1.5 pr-0.5 text-left text-xs font-medium"
              onClick={() => setActiveWorkspace(id)}
            >
              {t('workspace.tabLabel', { index: i + 1 })}
            </button>
            {canCloseTab ? (
              <button
                type="button"
                title={t('workspace.closeTab')}
                aria-label={t('workspace.closeTab')}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200/90 hover:text-zinc-800 dark:hover:bg-zinc-700/80 dark:hover:text-zinc-100"
                onClick={(e) => {
                  e.stopPropagation()
                  removeWorkspace(id)
                }}
              >
                ×
              </button>
            ) : null}
          </div>
        )
      })}
      <button
        type="button"
        title={t('workspace.addTab')}
        aria-label={t('workspace.addTab')}
        onClick={() => addWorkspaceCloneOfActive()}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-lg leading-none text-zinc-500 transition hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:text-cyan-800 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-cyan-500/40 dark:hover:text-cyan-200"
      >
        +
      </button>
    </div>
  )
}
