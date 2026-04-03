"use client"

import * as React from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { ChevronsUpDownIcon, PlusIcon, BuildingIcon } from "lucide-react"

export type Workspace = {
  id: string
  name: string
  description?: string | null
}

export function WorkspaceSwitcher({
  workspaces,
  activeId,
  onSelect,
  onCreate,
}: {
  workspaces: Workspace[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
}) {
  const { isMobile } = useSidebar()
  const active = workspaces.find((w) => w.id === activeId)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
              />
            }
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[var(--brand-gold)] text-white text-xs font-bold">
              {active ? active.name.charAt(0).toUpperCase() : "?"}
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">
                {active?.name ?? "選擇 Workspace"}
              </span>
              {active?.description && (
                <span className="truncate text-xs text-muted-foreground">
                  {active.description}
                </span>
              )}
            </div>
            <ChevronsUpDownIcon className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Workspaces
            </DropdownMenuLabel>
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => onSelect(ws.id)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md bg-[var(--brand-gold)] text-white text-xs font-bold">
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">{ws.name}</div>
                  {ws.description && (
                    <div className="text-xs text-muted-foreground">
                      {ws.description}
                    </div>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCreate} className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <PlusIcon className="size-4" />
              </div>
              <span className="font-medium text-muted-foreground">
                新增 Workspace
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
