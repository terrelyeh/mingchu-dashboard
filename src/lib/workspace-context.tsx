"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

export type Workspace = {
  id: string
  name: string
  description?: string | null
}

type WorkspaceContextValue = {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  loading: boolean
  setActiveWorkspaceId: (id: string) => void
  setWorkspaces: (ws: Workspace[]) => void
  addWorkspace: (ws: Workspace) => void
  refreshWorkspaces: () => Promise<void>
}

const DEMO_WS: Workspace = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "MINGCHU 臺灣",
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([DEMO_WS])
  const [activeId, setActiveId] = useState<string | null>(DEMO_WS.id)
  const [loading, setLoading] = useState(true)

  const activeWorkspace = workspaces.find((w) => w.id === activeId) ?? workspaces[0] ?? null

  const fetchWorkspaces = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, description")
        .order("created_at", { ascending: true })

      if (error) {
        console.warn("Failed to fetch workspaces, using defaults:", error.message)
        // Keep the demo workspace as fallback
        return
      }

      if (data && data.length > 0) {
        setWorkspaces(data)
        // If current activeId is not in fetched list, reset to first
        const saved = localStorage.getItem("mingchu-active-workspace")
        const targetId = saved && data.some((w) => w.id === saved) ? saved : data[0].id
        setActiveId(targetId)
      }
    } catch {
      console.warn("Workspace fetch error, using defaults")
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch workspaces on mount
  useEffect(() => {
    fetchWorkspaces()
  }, [fetchWorkspaces])

  const setActiveWorkspaceId = useCallback((id: string) => {
    setActiveId(id)
    if (typeof window !== "undefined") {
      localStorage.setItem("mingchu-active-workspace", id)
    }
  }, [])

  const addWorkspace = useCallback((ws: Workspace) => {
    setWorkspaces((prev) => [...prev, ws])
    setActiveId(ws.id)
    if (typeof window !== "undefined") {
      localStorage.setItem("mingchu-active-workspace", ws.id)
    }
  }, [])

  const refreshWorkspaces = useCallback(async () => {
    setLoading(true)
    await fetchWorkspaces()
  }, [fetchWorkspaces])

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        loading,
        setActiveWorkspaceId,
        setWorkspaces,
        addWorkspace,
        refreshWorkspaces,
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
