import { createContext, useContext, type ReactNode } from 'react'

const WorkspaceContext = createContext<string>('ws-default')

export function WorkspaceProvider({ id, children }: { id: string; children: ReactNode }) {
  return <WorkspaceContext.Provider value={id}>{children}</WorkspaceContext.Provider>
}

export function useWorkspaceId(): string {
  return useContext(WorkspaceContext)
}
