"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { WorkspaceSwitcher } from "@/components/workspace-switcher"
import { NavUser } from "@/components/nav-user"
import { useWorkspace } from "@/lib/workspace-context"
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

  const handleCreate = () => {
    const name = prompt("Workspace 名稱：")
    if (!name) return
    // TODO: call Supabase to create workspace
    // For now, create a temp local one
    const id = crypto.randomUUID()
    addWorkspace({ id, name })
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
        <NavUser
          user={{
            name: "使用者",
            email: "user@example.com",
            avatar: "",
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
