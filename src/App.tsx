import { useEffect, useState, useCallback } from 'react'
import { ServerSidebar } from '@/components/mcp/ServerSidebar'
import Update from '@/components/update'
import { UsageGuideModal } from '@/components/usage/UsageGuideModal'
import { McpServersImportExport } from '@/components/mcp/McpServersImportExport'
import { ServerDialog } from '@/components/mcp/ServerDialog'
import { ToolsPanel } from '@/components/mcp/ToolsPanel'
import { useAddressStore } from '@/stores/addressStore'
import { useToolsStore } from '@/stores/toolsStore'
import type { MCPHttpHeader, MCPServer } from '@shared/types'

export default function App() {
  const hydrate = useAddressStore((s) => s.hydrate)
  const addServer = useAddressStore((s) => s.addServer)
  const updateServer = useAddressStore((s) => s.updateServer)
  const servers = useAddressStore((s) => s.servers)
  const selectedId = useAddressStore((s) => s.selectedId)
  const fetchForUrl = useToolsStore((s) => s.fetchForUrl)

  const [dialog, setDialog] = useState<{
    mode: 'add' | 'edit'
    server: MCPServer | null
  } | null>(null)

  const selected = servers.find((s) => s.id === selectedId) ?? null

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    void fetchForUrl(
      selected?.url ?? null,
      selected?.headers,
      selected?.reuseMcpSession === true,
    )
  }, [selected, fetchForUrl])

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
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1">
        <ServerSidebar
          onAdd={() => setDialog({ mode: 'add', server: null })}
          onEdit={(s) => setDialog({ mode: 'edit', server: s })}
        />
        <ToolsPanel />
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
