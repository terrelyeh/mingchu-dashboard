"use client"

import { useEffect, useState, useCallback } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useWorkspace } from "@/lib/workspace-context"
import { createClient } from "@/lib/supabase/client"
import {
  BoxesIcon,
  LinkIcon,
  UsersIcon,
  TagIcon,
  RefreshCwIcon,
  PencilIcon,
  Trash2Icon,
  CheckIcon,
  XIcon,
} from "lucide-react"

type Goal = {
  id: string
  platform: string
  metric: string
  pic: string | null
}

type Category = {
  id: string
  name: string
  color: string
  sort_order: number
}

const DEMO_WS = "00000000-0000-0000-0000-000000000001"

const PRESET_COLORS = [
  "#4A90D9", "#E67E22", "#c99700", "#27AE60", "#8E44AD",
  "#E74C3C", "#3498DB", "#1ABC9C", "#F39C12", "#95A5A6",
]

const TABS = [
  { id: "workspace", label: "工作區", icon: BoxesIcon },
  { id: "connections", label: "連接", icon: LinkIcon },
  { id: "team", label: "團隊", icon: UsersIcon },
  { id: "categories", label: "分類", icon: TagIcon },
  { id: "sync", label: "同步", icon: RefreshCwIcon },
] as const

type TabId = (typeof TABS)[number]["id"]

export default function SettingsPage() {
  const { workspaces, activeWorkspace, setActiveWorkspaceId, setWorkspaces, addWorkspace } = useWorkspace()
  const wsId = activeWorkspace?.id ?? DEMO_WS

  const [activeTab, setActiveTab] = useState<TabId>("workspace")

  // Workspace management state
  const [renamingWs, setRenamingWs] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [newWsName, setNewWsName] = useState("")

  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPic, setEditingPic] = useState<Record<string, string>>({})
  const [savingPic, setSavingPic] = useState<Set<string>>(new Set())

  // Category state
  const [categories, setCategories] = useState<Category[]>([])
  const [catLoading, setCatLoading] = useState(true)
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [editCatName, setEditCatName] = useState("")
  const [editCatColor, setEditCatColor] = useState("")
  const [newCatName, setNewCatName] = useState("")
  const [newCatColor, setNewCatColor] = useState("#4A90D9")
  const [savingCat, setSavingCat] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    setLoading(true)
    setCatLoading(true)

    const fetchGoals = supabase
      .from("goals")
      .select("id, platform, metric, pic")
      .eq("workspace_id", wsId)
      .eq("year", new Date().getFullYear())

    const fetchCats = supabase
      .from("post_categories")
      .select("id, name, color, sort_order")
      .order("sort_order", { ascending: true })

    Promise.all([fetchGoals, fetchCats]).then(([goalsRes, catsRes]) => {
      const goalsData = goalsRes.data ?? []
      setGoals(goalsData)
      const picMap: Record<string, string> = {}
      for (const g of goalsData) {
        picMap[g.id] = g.pic ?? ""
      }
      setEditingPic(picMap)
      setLoading(false)

      setCategories(catsRes.data ?? [])
      setCatLoading(false)
    })
  }, [wsId])

  const savePic = useCallback(
    async (goalId: string) => {
      const newPic = editingPic[goalId]?.trim()
      if (newPic === undefined) return
      setSavingPic((prev) => new Set(prev).add(goalId))
      const supabase = createClient()
      await supabase
        .from("goals")
        .update({ pic: newPic || null })
        .eq("id", goalId)
      setGoals((prev) =>
        prev.map((g) => (g.id === goalId ? { ...g, pic: newPic || null } : g))
      )
      setSavingPic((prev) => {
        const next = new Set(prev)
        next.delete(goalId)
        return next
      })
    },
    [editingPic]
  )

  // Category CRUD
  const addCategory = async () => {
    const name = newCatName.trim()
    if (!name) return
    setSavingCat(true)
    const supabase = createClient()
    const maxOrder = categories.reduce((max, c) => Math.max(max, c.sort_order), 0)
    const { data } = await supabase
      .from("post_categories")
      .insert({ name, color: newCatColor, sort_order: maxOrder + 1 })
      .select("id, name, color, sort_order")
      .single()
    if (data) {
      setCategories((prev) => [...prev, data])
    }
    setNewCatName("")
    setNewCatColor("#4A90D9")
    setSavingCat(false)
  }

  const startEditCat = (cat: Category) => {
    setEditingCat(cat.id)
    setEditCatName(cat.name)
    setEditCatColor(cat.color)
  }

  const saveCategory = async (catId: string) => {
    const name = editCatName.trim()
    if (!name) return
    setSavingCat(true)
    const supabase = createClient()
    await supabase
      .from("post_categories")
      .update({ name, color: editCatColor })
      .eq("id", catId)
    setCategories((prev) =>
      prev.map((c) => (c.id === catId ? { ...c, name, color: editCatColor } : c))
    )
    setEditingCat(null)
    setSavingCat(false)
  }

  const deleteCategory = async (catId: string) => {
    if (!confirm("確定要刪除此分類嗎？已標記此分類的貼文將變為「未分類」。")) return
    const supabase = createClient()
    await supabase.from("post_categories").delete().eq("id", catId)
    setCategories((prev) => prev.filter((c) => c.id !== catId))
  }

  const moveCategoryUp = async (index: number) => {
    if (index <= 0) return
    const updated = [...categories]
    const temp = updated[index - 1].sort_order
    updated[index - 1].sort_order = updated[index].sort_order
    updated[index].sort_order = temp
    ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
    setCategories(updated)
    const supabase = createClient()
    await Promise.all([
      supabase.from("post_categories").update({ sort_order: updated[index - 1].sort_order }).eq("id", updated[index - 1].id),
      supabase.from("post_categories").update({ sort_order: updated[index].sort_order }).eq("id", updated[index].id),
    ])
  }

  const moveCategoryDown = async (index: number) => {
    if (index >= categories.length - 1) return
    const updated = [...categories]
    const temp = updated[index + 1].sort_order
    updated[index + 1].sort_order = updated[index].sort_order
    updated[index].sort_order = temp
    ;[updated[index + 1], updated[index]] = [updated[index], updated[index + 1]]
    setCategories(updated)
    const supabase = createClient()
    await Promise.all([
      supabase.from("post_categories").update({ sort_order: updated[index + 1].sort_order }).eq("id", updated[index + 1].id),
      supabase.from("post_categories").update({ sort_order: updated[index].sort_order }).eq("id", updated[index].id),
    ])
  }

  // Workspace CRUD
  const handleCreateWorkspace = async () => {
    const name = newWsName.trim()
    if (!name) return
    const supabase = createClient()
    const { data } = await supabase
      .from("workspaces")
      .insert({ name })
      .select("id, name, description")
      .single()
    if (data) {
      addWorkspace(data)
    }
    setNewWsName("")
  }

  const handleRenameWorkspace = async (id: string) => {
    const name = renameValue.trim()
    if (!name) return
    const supabase = createClient()
    await supabase.from("workspaces").update({ name }).eq("id", id)
    setWorkspaces(
      workspaces.map((w) => (w.id === id ? { ...w, name } : w))
    )
    setRenamingWs(null)
  }

  const handleDeleteWorkspace = async (id: string) => {
    if (workspaces.length <= 1) return
    if (!confirm("確定要刪除此工作區嗎？所有相關數據將一併刪除，此操作無法復原。")) return
    const supabase = createClient()
    await supabase.from("workspaces").delete().eq("id", id)
    setWorkspaces(workspaces.filter((w) => w.id !== id))
    if (activeWorkspace?.id === id && workspaces.length > 1) {
      const remaining = workspaces.filter((w) => w.id !== id)
      setActiveWorkspaceId(remaining[0].id)
    }
  }

  // Deduplicate: group goals by platform, show unique platforms
  const platforms = [...new Set(goals.map((g) => g.platform))]

  const platformLabel = (p: string) =>
    p === "facebook" ? "Facebook" : p === "instagram" ? "Instagram" : p
  const platformColor = (p: string) =>
    p === "facebook" ? "var(--fb-blue)" : "var(--ig-pink)"

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-vertical:h-4" />
        <h1 className="text-lg font-semibold">設定</h1>
      </header>
      <div className="flex flex-1 flex-col gap-6 px-6 pb-6">
        {/* Tab bar */}
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab: 工作區 */}
        {activeTab === "workspace" && (
          <Card>
            <CardHeader>
              <CardTitle>工作區管理</CardTitle>
              <CardDescription>
                每個工作區對應一組社群帳號（如不同品牌或地區），擁有獨立的數據和設定。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing workspaces */}
              <div className="space-y-2">
                {workspaces.map((ws) => (
                  <div
                    key={ws.id}
                    className={`flex items-center gap-3 rounded-lg border p-4 ${
                      activeWorkspace?.id === ws.id ? "border-[var(--brand-gold)] bg-[var(--brand-gold)]/5" : ""
                    }`}
                  >
                    {renamingWs === ws.id ? (
                      <>
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="flex-1 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameWorkspace(ws.id)
                            if (e.key === "Escape") setRenamingWs(null)
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleRenameWorkspace(ws.id)}
                          className="rounded p-1.5 text-green-600 hover:bg-green-50"
                          title="確認"
                        >
                          <CheckIcon className="size-4" />
                        </button>
                        <button
                          onClick={() => setRenamingWs(null)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                          title="取消"
                        >
                          <XIcon className="size-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-medium">
                          {ws.name}
                        </span>
                        {activeWorkspace?.id === ws.id && (
                          <Badge variant="secondary" className="bg-[var(--brand-gold)]/15 text-[var(--brand-gold)]">
                            使用中
                          </Badge>
                        )}
                        {activeWorkspace?.id !== ws.id && (
                          <button
                            onClick={() => setActiveWorkspaceId(ws.id)}
                            className="rounded border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                          >
                            切換
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setRenamingWs(ws.id)
                            setRenameValue(ws.name)
                          }}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                          title="重新命名"
                        >
                          <PencilIcon className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteWorkspace(ws.id)}
                          disabled={workspaces.length <= 1}
                          className="rounded p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-20"
                          title="刪除"
                        >
                          <Trash2Icon className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Add new workspace */}
              <div className="flex items-center gap-3 rounded-lg border border-dashed p-4">
                <input
                  type="text"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="新增工作區名稱..."
                  className="flex-1 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateWorkspace()}
                />
                <button
                  onClick={handleCreateWorkspace}
                  disabled={!newWsName.trim()}
                  className="rounded bg-[var(--brand-gold)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-gold)]/90 disabled:opacity-40"
                >
                  新增
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                刪除工作區將同時移除該工作區下所有數據，包含歷史紀錄、目標設定及貼文分析資料。
              </p>
            </CardContent>
          </Card>
        )}

        {/* Tab: 連接 */}
        {activeTab === "connections" && (
          <Card>
            <CardHeader>
              <CardTitle>社群帳號連接</CardTitle>
              <CardDescription>
                連接 Facebook 粉專與 Instagram 帳號以自動擷取數據。連接後系統將自動排程同步。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ConnectionRow platform="Facebook" status="未連接" />
              <ConnectionRow platform="Instagram" status="未連接" />
              <p className="text-xs text-muted-foreground pt-2">
                連接需要 Facebook 粉絲專頁管理員權限。Instagram 商業帳號需先綁定 Facebook 粉專。
              </p>
            </CardContent>
          </Card>
        )}

        {/* Tab: 團隊 */}
        {activeTab === "team" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>平台負責人設定</CardTitle>
                <CardDescription>
                  設定各社群平台的負責人，將顯示在週報追蹤頁面
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex h-[80px] items-center justify-center text-muted-foreground">
                    載入中...
                  </div>
                ) : platforms.length === 0 ? (
                  <div className="flex h-[80px] items-center justify-center text-muted-foreground text-sm">
                    尚未設定目標，請先在目標模擬器中確認目標
                  </div>
                ) : (
                  <div className="space-y-3">
                    {platforms.map((plat) => {
                      const goal = goals.find((g) => g.platform === plat)
                      if (!goal) return null
                      return (
                        <div
                          key={plat}
                          className="flex items-center gap-3 rounded-lg border p-4"
                        >
                          <div
                            className="size-3 shrink-0 rounded-full"
                            style={{ backgroundColor: platformColor(plat) }}
                          />
                          <span className="font-medium min-w-[90px]">
                            {platformLabel(plat)}
                          </span>
                          <input
                            type="text"
                            value={editingPic[goal.id] ?? ""}
                            onChange={(e) =>
                              setEditingPic((prev) => ({
                                ...prev,
                                [goal.id]: e.target.value,
                              }))
                            }
                            placeholder="輸入負責人姓名"
                            className="flex-1 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                          />
                          <button
                            onClick={() => savePic(goal.id)}
                            disabled={
                              savingPic.has(goal.id) ||
                              (editingPic[goal.id] ?? "") === (goal.pic ?? "")
                            }
                            className="rounded bg-[var(--brand-gold)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-gold)]/90 disabled:opacity-40"
                          >
                            {savingPic.has(goal.id) ? "儲存中..." : "儲存"}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>使用者管理</CardTitle>
                <CardDescription>管理允許登入的 Email 白名單</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex h-[120px] items-center justify-center text-muted-foreground text-sm">
                  使用者白名單管理 — 待實作
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Tab: 分類 */}
        {activeTab === "categories" && (
          <Card>
            <CardHeader>
              <CardTitle>貼文分類管理</CardTitle>
              <CardDescription>
                管理貼文分析頁面使用的分類標籤。可新增、編輯、排序或刪除分類。
              </CardDescription>
            </CardHeader>
            <CardContent>
              {catLoading ? (
                <div className="flex h-[80px] items-center justify-center text-muted-foreground">
                  載入中...
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Existing categories */}
                  <div className="space-y-2">
                    {categories.map((cat, index) => (
                      <div
                        key={cat.id}
                        className="flex items-center gap-3 rounded-lg border p-3"
                      >
                        {/* Sort buttons */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => moveCategoryUp(index)}
                            disabled={index === 0}
                            className="rounded px-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-20"
                            title="上移"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveCategoryDown(index)}
                            disabled={index === categories.length - 1}
                            className="rounded px-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-20"
                            title="下移"
                          >
                            ▼
                          </button>
                        </div>

                        {editingCat === cat.id ? (
                          <>
                            <input
                              type="color"
                              value={editCatColor}
                              onChange={(e) => setEditCatColor(e.target.value)}
                              className="size-8 shrink-0 cursor-pointer rounded border-0 p-0"
                            />
                            <input
                              type="text"
                              value={editCatName}
                              onChange={(e) => setEditCatName(e.target.value)}
                              className="flex-1 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                              onKeyDown={(e) => e.key === "Enter" && saveCategory(cat.id)}
                            />
                            <button
                              onClick={() => saveCategory(cat.id)}
                              disabled={savingCat}
                              className="rounded bg-[var(--brand-gold)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                            >
                              儲存
                            </button>
                            <button
                              onClick={() => setEditingCat(null)}
                              className="rounded border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <>
                            <div
                              className="size-5 shrink-0 rounded"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="flex-1 text-sm font-medium">{cat.name}</span>
                            <button
                              onClick={() => startEditCat(cat)}
                              className="rounded border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                            >
                              編輯
                            </button>
                            <button
                              onClick={() => deleteCategory(cat.id)}
                              className="rounded border border-red-200 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50"
                            >
                              刪除
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add new category */}
                  <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
                    <input
                      type="color"
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      className="size-8 shrink-0 cursor-pointer rounded border-0 p-0"
                    />
                    <input
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="新增分類名稱..."
                      className="flex-1 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                      onKeyDown={(e) => e.key === "Enter" && addCategory()}
                    />
                    <button
                      onClick={addCategory}
                      disabled={savingCat || !newCatName.trim()}
                      className="rounded bg-[var(--brand-gold)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-gold)]/90 disabled:opacity-40"
                    >
                      新增
                    </button>
                  </div>

                  {/* Quick color palette */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground mr-1">快速選色：</span>
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewCatColor(color)}
                        className={`size-5 rounded-full border-2 transition-transform hover:scale-110 ${
                          newCatColor === color ? "border-foreground scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab: 同步 */}
        {activeTab === "sync" && (
          <Card>
            <CardHeader>
              <CardTitle>資料同步策略說明</CardTitle>
              <CardDescription>
                連接社群帳號後，系統將依以下排程自動擷取數據。你也可以隨時手動觸發同步。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">資料類型</TableHead>
                      <TableHead className="min-w-[120px]">同步頻率</TableHead>
                      <TableHead className="min-w-[80px]">方式</TableHead>
                      <TableHead className="min-w-[200px]">說明</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SyncRow
                      type="粉絲數快照"
                      freq="每日 1 次"
                      method="auto"
                      desc="每日凌晨自動擷取 Facebook / Instagram 粉絲總數"
                    />
                    <SyncRow
                      type="週報數據"
                      freq="每週一凌晨"
                      method="auto"
                      desc="自動彙整上週觸及、新增追蹤、互動數，寫入週報追蹤"
                    />
                    <SyncRow
                      type="月報數據"
                      freq="每月 1 號凌晨"
                      method="auto"
                      desc="撈取上個月完整月度數據（自然觸及、廣告觸及、互動等）"
                    />
                    <SyncRow
                      type="貼文列表"
                      freq="每日 1 次"
                      method="auto"
                      desc="擷取新發布貼文的觸及、互動、連結點擊等指標"
                    />
                    <SyncRow
                      type="貼文 W1 觸及"
                      freq="發布後第 7 天"
                      method="auto"
                      desc="貼文發布滿 7 天後，自動擷取第一週累積觸及"
                    />
                    <SyncRow
                      type="貼文 W2 觸及"
                      freq="發布後第 14 天"
                      method="auto"
                      desc="貼文發布滿 14 天後，自動擷取第二週累積觸及"
                    />
                    <SyncRow
                      type="歷史資料回填"
                      freq="一次性"
                      method="manual"
                      desc="首次連接帳號時，可手動觸發回填過去的歷史數據"
                    />
                    <SyncRow
                      type="即時刷新"
                      freq="隨時"
                      method="manual"
                      desc="在此頁面按「立即同步」按鈕，手動觸發一次完整資料更新"
                    />
                  </TableBody>
                </Table>
              </div>

              {/* Sync action buttons */}
              <div className="flex flex-wrap gap-3 rounded-lg bg-muted/30 p-4">
                <button
                  disabled
                  className="rounded-lg bg-[var(--brand-gold)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-gold)]/90 disabled:opacity-40"
                >
                  立即同步所有資料
                </button>
                <button
                  disabled
                  className="rounded-lg border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                >
                  回填歷史資料
                </button>
                <p className="w-full text-xs text-muted-foreground mt-1">
                  請先連接社群帳號後才能使用同步功能
                </p>
              </div>

              {/* API Notes */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm space-y-2">
                <p className="font-semibold text-amber-800">注意事項</p>
                <ul className="list-disc pl-4 space-y-1 text-amber-700 text-xs">
                  <li>
                    Meta API 有速率限制（約 200 次/小時），系統已合併請求以避免超限
                  </li>
                  <li>
                    Facebook 月度不重複觸及（UU）使用伺服器端去重數據；Instagram UU 為每日累計近似值，前端會標註「近似」
                  </li>
                  <li>
                    Instagram API 不提供連結點擊數，該欄位僅適用於 Facebook
                  </li>
                  <li>
                    貼文分類無法由 API 自動判斷，需由負責人在貼文分析頁面手動標記
                  </li>
                  <li>
                    OAuth Token 由系統自動續期，無需手動處理
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

function ConnectionRow({
  platform,
  status,
}: {
  platform: string
  status: string
}) {
  const color =
    platform === "Facebook" ? "var(--fb-blue)" : "var(--ig-pink)"
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <div
          className="size-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="font-medium">{platform}</span>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="secondary">{status}</Badge>
        <button
          disabled
          className="rounded bg-[var(--brand-gold)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          連接
        </button>
      </div>
    </div>
  )
}

function SyncRow({
  type,
  freq,
  method,
  desc,
}: {
  type: string
  freq: string
  method: "auto" | "manual"
  desc: string
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{type}</TableCell>
      <TableCell className="tabular-nums">{freq}</TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className={
            method === "auto"
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }
        >
          {method === "auto" ? "自動" : "手動"}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">{desc}</TableCell>
    </TableRow>
  )
}
