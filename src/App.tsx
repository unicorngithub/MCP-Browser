import { useEffect, useState, useCallback, useMemo } from 'react'
import { ServerSidebar } from '@/components/mcp/ServerSidebar'
import Update from '@/components/update'
import { UsageGuideModal } from '@/components/usage/UsageGuideModal'
import { McpServersImportExport } from '@/components/mcp/McpServersImportExport'
import { ServerDialog } from '@/components/mcp/ServerDialog'
import { ToolsPanel } from '@/components/mcp/ToolsPanel'
import { WorkspaceTabBar } from '@/components/workspace/WorkspaceTabBar'
import { WorkspaceProvider, useWorkspaceId } from '@/context/WorkspaceContext'
import { useAddressStore } from '@/stores/addressStore'
import { useMcpSessionReuseStore } from '@/stores/mcpSessionReuseStore'
import { useToolsStore } from '@/stores/toolsStore'
import { DEFAULT_WORKSPACE_ID, useWorkspaceUiStore } from '@/stores/workspaceUiStore'
import type { MCPHttpHeader, MCPServer } from '@shared/types'
import { setAppLanguage } from '@/i18n/i18n'

/** 单栏或多标签下，侧栏 + 工具区；按工作区隔离 tools 状态 */
function McpWorkspaceShell({
  onAdd,
  onEdit,
}: {
  onAdd: () => void
  onEdit: (s: MCPServer) => void
}) {
  const workspaceId = useWorkspaceId()
  const servers = useAddressStore((s) => s.servers)
  const selectedId = useWorkspaceUiStore((s) => s.selectedServerByWs[workspaceId] ?? null)
  const selected = useMemo(
    () => servers.find((s) => s.id === selectedId) ?? null,
    [servers, selectedId],
  )
  const fetchForUrl = useToolsStore((s) => s.fetchForUrl)
  const mcpHttpTransport = useToolsStore((s) => s.mcpHttpTransport)
  const sessionReuseOn = useMcpSessionReuseStore((s) =>
    selected?.id ? s.isReuseMcpSession(workspaceId, selected.id) : false,
  )

  useEffect(() => {
    const reuse = sessionReuseOn && mcpHttpTransport !== 'sse'
    void fetchForUrl(selected?.url ?? null, selected?.headers, reuse)
  }, [selected, fetchForUrl, mcpHttpTransport, sessionReuseOn])

  return (
    <div className="relative z-10 flex min-h-0 min-w-0 flex-1">
      <ServerSidebar onAdd={onAdd} onEdit={onEdit} />
      <ToolsPanel />
    </div>
  )
}

export default function App() {
  const hydrate = useAddressStore((s) => s.hydrate)
  const addServer = useAddressStore((s) => s.addServer)
  const updateServer = useAddressStore((s) => s.updateServer)

  const [dialog, setDialog] = useState<{
    mode: 'add' | 'edit'
    server: MCPServer | null
  } | null>(null)

  const windowMode = useWorkspaceUiStore((s) => s.windowMode)
  const workspaceOrder = useWorkspaceUiStore((s) => s.workspaceOrder)
  const activeWorkspaceId = useWorkspaceUiStore((s) => s.activeWorkspaceId)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    const unsub = window.appLocale?.onMenuLanguageSelect?.((lng) => {
      setAppLanguage(lng)
    })
    return () => {
      unsub?.()
    }
  }, [])

  useEffect(() => {
    if (!window.appWorkspace) return () => {}
    void window.appWorkspace.getWindowMode().then((m) => {
      useWorkspaceUiStore.getState().setWindowMode(m)
      if (m === 'single') useWorkspaceUiStore.getState().collapseToSingleWorkspace()
    })
    return window.appWorkspace.onWindowMode((mode) => {
      useWorkspaceUiStore.getState().setWindowMode(mode)
      if (mode === 'single') useWorkspaceUiStore.getState().collapseToSingleWorkspace()
    })
  }, [])

  const onSave = useCallback(
    async (name: string, url: string, headers: MCPHttpHeader[]) => {
      if (dialog?.mode === 'edit' && dialog.server) {
        await updateServer(dialog.server.id, name, url, headers)
      } else {
        await addServer(name, url, headers)
      }
    },
    [dialog, addServer, updateServer],
  )

  const shellWorkspaceIds =
    windowMode === 'single' ? [DEFAULT_WORKSPACE_ID] : workspaceOrder

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-30 dark:opacity-40"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(56, 189, 248, 0.15), transparent), radial-gradient(ellipse 60% 40% at 100% 50%, rgba(45, 212, 191, 0.08), transparent), radial-gradient(ellipse 50% 30% at 0% 80%, rgba(99, 102, 241, 0.06), transparent)',
        }}
      />
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
        {windowMode === 'multi' ? <WorkspaceTabBar /> : null}
        <div className="flex min-h-0 flex-1">
          {shellWorkspaceIds.map((id) => (
            <div
              key={id}
              className={
                windowMode === 'multi' && id !== activeWorkspaceId
                  ? 'hidden'
                  : 'flex min-h-0 min-w-0 flex-1'
              }
            >
              <WorkspaceProvider id={id}>
                <McpWorkspaceShell
                  onAdd={() => setDialog({ mode: 'add', server: null })}
                  onEdit={(s) => setDialog({ mode: 'edit', server: s })}
                />
              </WorkspaceProvider>
            </div>
          ))}
        </div>
      </div>
      <ServerDialog
        open={dialog !== null}
        mode={dialog?.mode ?? 'add'}
        server={dialog?.server ?? null}
        onClose={() => setDialog(null)}
        onSave={onSave}
      />
      <McpServersImportExport />
      <UsageGuideModal />
      <Update />
    </div>
  )
}
