"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"

export type Workspace = {
  id: string
  name: string
  description?: string | null
}

type WorkspaceContextValue = {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  setActiveWorkspaceId: (id: string) => void
  setWorkspaces: (ws: Workspace[]) => void
  addWorkspace: (ws: Workspace) => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const activeWorkspace = workspaces.find((w) => w.id === activeId) ?? workspaces[0] ?? null

  // Auto-select first workspace when loaded
  useEffect(() => {
    if (!activeId && workspaces.length > 0) {
      setActiveId(workspaces[0].id)
    }
  }, [workspaces, activeId])

  const setActiveWorkspaceId = useCallback((id: string) => {
    setActiveId(id)
    if (typeof window !== "undefined") {
      localStorage.setItem("mingchu-active-workspace", id)
    }
  }, [])

  // Restore from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("mingchu-active-workspace")
    if (saved) setActiveId(saved)
  }, [])

  const addWorkspace = useCallback((ws: Workspace) => {
    setWorkspaces((prev) => [...prev, ws])
    setActiveId(ws.id)
  }, [])

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        setActiveWorkspaceId,
        setWorkspaces,
        addWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider")
  return ctx
}
