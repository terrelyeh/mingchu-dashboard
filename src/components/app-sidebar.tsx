"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { WorkspaceSwitcher } from "@/components/workspace-switcher"
import { NavUser } from "@/components/nav-user"
import { useWorkspace } from "@/lib/workspace-context"
import { createClient } from "@/lib/supabase/client"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  CalendarIcon,
  ClipboardListIcon,
  FileTextIcon,
  TargetIcon,
  SettingsIcon,
  ActivityIcon,
} from "lucide-react"

const navItems = [
  { title: "總覽", url: "/dashboard", icon: LayoutDashboardIcon },
{ title: "月度明細", url: "/dashboard/monthly", icon: CalendarIcon },
  { title: "週報追蹤", url: "/dashboard/weekly", icon: ClipboardListIcon },
  { title: "貼文分析", url: "/dashboard/posts", icon: FileTextIcon },
  { title: "目標模擬器", url: "/dashboard/simulator", icon: TargetIcon },
  { title: "API 診斷", url: "/dashboard/api-health", icon: ActivityIcon },
  { title: "設定", url: "/dashboard/settings", icon: SettingsIcon },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { workspaces, activeWorkspace, setActiveWorkspaceId, addWorkspace } =
    useWorkspace()

  // Fetch real user info
  const [user, setUser] = useState({ name: "使用者", email: "", avatar: "" })
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) {
        setUser({
          name: u.user_metadata?.full_name ?? u.email?.split("@")[0] ?? "使用者",
          email: u.email ?? "",
          avatar: u.user_metadata?.avatar_url ?? "",
        })
      }
    })
  }, [])

  const handleCreate = async () => {
    const name = prompt("Workspace 名稱：")
    if (!name?.trim()) return

    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()

    // 1. Create workspace
    const { data, error } = await supabase
      .from("workspaces")
      .insert({ name: name.trim() })
      .select("id, name, description")
      .single()

    if (error) {
      alert(`建立失敗：${error.message}`)
      return
    }

    if (data) {
      // 2. Auto-join as admin
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from("workspace_members").insert({
          workspace_id: data.id,
          user_id: user.id,
          role: "admin",
        })
      }
      addWorkspace(data)
    }
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="px-4">
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeId={activeWorkspace?.id ?? null}
          onSelect={setActiveWorkspaceId}
          onCreate={handleCreate}
        />
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.url === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.url)
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link href={item.url} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
