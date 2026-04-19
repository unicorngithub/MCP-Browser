import { Fragment, useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MCPServer } from '@shared/types'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import UpdateModal from '@/components/update/Modal'
import { useWorkspaceId } from '@/context/WorkspaceContext'
import { useAddressStore } from '@/stores/addressStore'
import { useWorkspaceUiStore } from '@/stores/workspaceUiStore'

interface ServerSidebarProps {
  onAdd: () => void
  onEdit: (s: MCPServer) => void
}

export function ServerSidebar({ onAdd, onEdit }: ServerSidebarProps) {
  const { t } = useTranslation()
  const workspaceId = useWorkspaceId()
  const { servers, removeServer, reorderServers, ready } = useAddressStore()
  const selectedId = useWorkspaceUiStore((s) => s.selectedServerByWs[workspaceId] ?? null)
  const select = useCallback(
    (id: string | null) => {
      useWorkspaceUiStore.getState().setSelectedForWorkspace(workspaceId, id)
    },
    [workspaceId],
  )
  const dragFromRef = useRef<number | null>(null)
  const [dropBefore, setDropBefore] = useState<number | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const pendingDelete = useMemo(
    () => (pendingDeleteId ? servers.find((s) => s.id === pendingDeleteId) : undefined),
    [servers, pendingDeleteId],
  )

  const clearDrop = useCallback(() => setDropBefore(null), [])

  const onRowDragStart = useCallback(
    (index: number, e: React.DragEvent) => {
      e.stopPropagation()
      dragFromRef.current = index
      e.dataTransfer.setData('text/plain', String(index))
      e.dataTransfer.effectAllowed = 'move'
    },
    [],
  )

  const onRowDragEnd = useCallback(() => {
    dragFromRef.current = null
    clearDrop()
  }, [clearDrop])

  const onRowDragOver = useCallback(
    (beforeIndex: number, e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
      setDropBefore(beforeIndex)
    },
    [],
  )

  const onRowDrop = useCallback(
    (beforeIndex: number, e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const raw = e.dataTransfer.getData('text/plain')
      const from = raw ? Number.parseInt(raw, 10) : dragFromRef.current ?? NaN
      if (Number.isNaN(from)) return
      void reorderServers(from, beforeIndex)
      clearDrop()
    },
    [reorderServers, clearDrop],
  )

  const endDropBefore = servers.length

  return (
    <>
    <aside className="flex h-full w-[17.5rem] shrink-0 flex-col border-r border-zinc-200/80 bg-white/70 shadow-[inset_-1px_0_0_rgba(0,0,0,0.04)] backdrop-blur-xl dark:border-white/[0.06] dark:bg-zinc-950/80 dark:shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)]">
      <div className="border-b border-zinc-200/80 px-4 pb-4 pt-2 dark:border-white/[0.06]">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-600 dark:text-cyan-400/90">
            MCP BROWSER
          </div>
          <LanguageSwitcher />
        </div>
        <div className="select-none">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">{t('sidebar.title')}</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">{t('sidebar.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-2.5 text-sm font-medium text-zinc-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 active:scale-[0.98]"
        >
          <span className="text-lg leading-none">+</span>
          {t('sidebar.addAddress')}
        </button>
      </div>

      <div
        className="px-3 pt-2 pb-0.5"
        onDragOver={(e) => {
          if (!ready || servers.length === 0) return
          onRowDragOver(0, e)
        }}
        onDrop={(e) => {
          if (!ready || servers.length === 0) return
          onRowDrop(0, e)
        }}
      >
        <div className="px-1 text-[11px] font-medium normal-case tracking-wide text-zinc-500 dark:text-zinc-600">
          {t('sidebar.listHeading')}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pt-0">
        {!ready ? (
          <div className="mx-1 select-none rounded-xl border border-dashed border-zinc-300 bg-zinc-100/80 px-3 py-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-500">
            {t('sidebar.loadingConfig')}
          </div>
        ) : servers.length === 0 ? (
          <div className="mx-1 select-none rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-3 py-8 text-center dark:border-zinc-800 dark:bg-zinc-900/20">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('sidebar.noAddresses')}</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-600">{t('sidebar.noAddressesHint')}</p>
          </div>
        ) : (
          <>
          {/* 独立 6px 间隙行（= gap-1.5），横线在行内垂直居中，不依赖负 top，避免裁切与任意类不生效 */}
          <ul className="flex min-h-0 flex-1 list-none flex-col overflow-y-auto pb-1 pt-0">
            {servers.map((s, index) => {
              const active = s.id === selectedId
              const showGapLine = dropBefore === index
              return (
                <Fragment key={s.id}>
                  <li
                    className={`relative h-1.5 shrink-0 ${showGapLine ? 'bg-cyan-500/10 dark:bg-cyan-400/8' : ''}`}
                    onDragOver={(e) => onRowDragOver(index, e)}
                    onDrop={(e) => onRowDrop(index, e)}
                  >
                    {showGapLine ? (
                      <div
                        className="pointer-events-none absolute left-2 right-2 top-1/2 z-10 h-1.5 -translate-y-1/2 rounded-full bg-cyan-500/55 shadow-[0_0_8px_rgba(6,182,212,0.35)] dark:bg-cyan-400/45"
                        aria-hidden
                      />
                    ) : null}
                  </li>
                  <li
                    className="relative list-none"
                    onDragOver={(e) => onRowDragOver(index, e)}
                    onDrop={(e) => onRowDrop(index, e)}
                  >
                  <div
                    className={`group relative overflow-hidden rounded-xl border transition-all ${
                      active
                        ? 'border-cyan-500/50 bg-gradient-to-br from-cyan-500/15 to-teal-500/10 shadow-sm dark:border-cyan-500/40 dark:from-cyan-500/10 dark:to-teal-500/5 dark:shadow-panel'
                        : 'border-transparent bg-zinc-100/90 hover:border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900/40 dark:hover:border-zinc-700/80 dark:hover:bg-zinc-900/70'
                    } ${dropBefore === index ? 'ring-1 ring-cyan-500/22 ring-offset-1 ring-offset-zinc-50 dark:ring-offset-zinc-950' : ''}`}
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
                        draggable
                        title={t('sidebar.dragHandleTitle')}
                        aria-label={`${s.name}. ${t('sidebar.dragHandleAria')}`}
                        onClick={() => select(s.id)}
                        onDragStart={(e) => onRowDragStart(index, e)}
                        onDragEnd={onRowDragEnd}
                        onKeyDown={(e) => {
                          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
                          e.preventDefault()
                          const n = servers.length
                          if (e.key === 'ArrowUp') {
                            if (index > 0) void reorderServers(index, index - 1)
                            return
                          }
                          if (index < n - 1) void reorderServers(index, Math.min(index + 2, n))
                        }}
                        className="min-w-0 flex-1 cursor-pointer touch-none select-none px-3 py-2.5 text-left"
                      >
                        <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{s.name}</div>
                        <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">{s.url}</div>
                      </button>
                      <div className="flex shrink-0 flex-col justify-center gap-0.5 border-l border-zinc-200/90 py-1 pr-1 pl-0.5 dark:border-white/[0.04]">
                        <button
                          type="button"
                          draggable={false}
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
                          draggable={false}
                          title={t('sidebar.deleteTitle')}
                          onClick={(e) => {
                            e.stopPropagation()
                            setPendingDeleteId(s.id)
                          }}
                          className="rounded-md px-2 py-1 text-[11px] text-zinc-600 transition hover:bg-red-500/10 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                        >
                          {t('sidebar.delete')}
                        </button>
                      </div>
                    </div>
                  </div>
                  </li>
                </Fragment>
              )
            })}
            <li
              className="relative flex min-h-8 flex-1 list-none flex-col rounded-lg"
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                e.dataTransfer.dropEffect = 'move'
                setDropBefore(endDropBefore)
              }}
              onDrop={(e) => onRowDrop(endDropBefore, e)}
            >
              <div
                className={`relative h-1.5 shrink-0 ${dropBefore === endDropBefore ? 'bg-cyan-500/10 dark:bg-cyan-400/8' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  e.dataTransfer.dropEffect = 'move'
                  setDropBefore(endDropBefore)
                }}
                onDrop={(e) => onRowDrop(endDropBefore, e)}
              >
                {dropBefore === endDropBefore ? (
                  <div
                    className="pointer-events-none absolute left-2 right-2 top-1/2 z-10 h-1.5 -translate-y-1/2 rounded-full bg-cyan-500/55 shadow-[0_0_8px_rgba(6,182,212,0.35)] dark:bg-cyan-400/45"
                    aria-hidden
                  />
                ) : null}
              </div>
              <div
                className="min-h-4 flex-1"
                aria-hidden
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  e.dataTransfer.dropEffect = 'move'
                  setDropBefore(endDropBefore)
                }}
                onDrop={(e) => onRowDrop(endDropBefore, e)}
              />
            </li>
          </ul>
          {/* 独立底部热区：原先 pb-4 空白无法 drop；此处始终 preventDefault，避免禁止光标 */}
          <div
            className="h-4 shrink-0"
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setDropBefore(endDropBefore)
            }}
            onDrop={(e) => onRowDrop(endDropBefore, e)}
            aria-hidden
          />
          </>
        )}
      </div>
    </aside>
    <UpdateModal
      open={pendingDeleteId !== null}
      title={t('sidebar.deleteConfirmTitle')}
      titleId="sidebar-delete-confirm-title"
      cancelText={t('sidebar.deleteConfirmCancel')}
      okText={t('sidebar.deleteConfirmAction')}
      onCancel={() => setPendingDeleteId(null)}
      onOk={() => {
        const id = pendingDeleteId
        setPendingDeleteId(null)
        if (id) void removeServer(id)
      }}
    >
      <p className="whitespace-pre-wrap break-words leading-relaxed">
        {t('sidebar.deleteConfirmDetail', {
          name: pendingDelete?.name ?? '',
          url: pendingDelete?.url ?? '',
        })}
      </p>
    </UpdateModal>
    </>
  )
}
