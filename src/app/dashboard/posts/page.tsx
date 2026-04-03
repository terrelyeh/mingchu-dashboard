"use client"

import { useEffect, useState, useMemo } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { NativeSelect } from "@/components/ui/native-select"
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

type PostRow = {
  id: string
  platform: string
  message: string | null
  published_at: string
  organic_reach: number | null
  total_engagement: number | null
  link_clicks: number | null
  reach_w1: number | null
  reach_w2: number | null
  category_id: string | null
}

type Category = {
  id: string
  name: string
  color: string
}

const DEMO_WS = "00000000-0000-0000-0000-000000000001"
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"]

export default function PostsPage() {
  const { activeWorkspace } = useWorkspace()
  const wsId = activeWorkspace?.id ?? DEMO_WS

  const [posts, setPosts] = useState<PostRow[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("reach")
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set())
  const [batchCategory, setBatchCategory] = useState<string>("")
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()
    setLoading(true)

    const fetchPosts = supabase
      .from("posts")
      .select(
        "id, platform, message, published_at, organic_reach, total_engagement, link_clicks, reach_w1, reach_w2, category_id"
      )
      .eq("workspace_id", wsId)
      .order("published_at", { ascending: false })

    const fetchCategories = supabase
      .from("post_categories")
      .select("id, name, color")
      .order("sort_order", { ascending: true })

    Promise.all([fetchPosts, fetchCategories]).then(([postsRes, catRes]) => {
      setPosts(postsRes.data ?? [])
      setCategories(catRes.data ?? [])
      setLoading(false)
    })
  }, [wsId])

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  )

  // Filtered posts
  const filtered = useMemo(() => {
    let result = posts
    if (platformFilter !== "all") {
      result = result.filter((p) => p.platform === platformFilter)
    }
    if (categoryFilter !== "all") {
      result = result.filter((p) => p.category_id === categoryFilter)
    }
    return result
  }, [posts, platformFilter, categoryFilter])

  // Sorted posts
  const sorted = useMemo(() => {
    const arr = [...filtered]
    if (sortBy === "reach") {
      arr.sort((a, b) => (b.organic_reach ?? 0) - (a.organic_reach ?? 0))
    } else if (sortBy === "engagement") {
      arr.sort((a, b) => (b.total_engagement ?? 0) - (a.total_engagement ?? 0))
    } else {
      // date or month — sort by date ascending
      arr.sort((a, b) => a.published_at.localeCompare(b.published_at))
    }
    return arr
  }, [filtered, sortBy])

  // Top 5 posts (by organic reach, respects platform filter)
  const top5 = useMemo(() => {
    const pool = platformFilter !== "all" ? posts.filter((p) => p.platform === platformFilter) : posts
    return [...pool]
      .sort((a, b) => (b.organic_reach ?? 0) - (a.organic_reach ?? 0))
      .slice(0, 5)
  }, [posts, platformFilter])

  // Monthly groups (for sort by month)
  const monthGroups = useMemo(() => {
    if (sortBy !== "month") return null
    const groups = new Map<string, PostRow[]>()
    const order: string[] = []
    for (const p of sorted) {
      const monthKey = p.published_at.substring(0, 7) // "2025-08"
      if (!groups.has(monthKey)) {
        groups.set(monthKey, [])
        order.push(monthKey)
      }
      groups.get(monthKey)!.push(p)
    }
    // Reverse so newest month first
    return { groups, order: order.reverse() }
  }, [sorted, sortBy])

  // Category performance chart data
  const categoryChartData = useMemo(() => {
    const stats = new Map<string, { totalReach: number; count: number }>()
    for (const post of posts) {
      if (!post.category_id) continue
      const cat = categoryMap.get(post.category_id)
      if (!cat) continue
      const existing = stats.get(cat.name) ?? { totalReach: 0, count: 0 }
      existing.totalReach += post.organic_reach ?? 0
      existing.count++
      stats.set(cat.name, existing)
    }
    return Array.from(stats.entries())
      .map(([name, s]) => ({
        name,
        avgReach: Math.round(s.totalReach / s.count),
        color: categories.find((c) => c.name === name)?.color ?? "#95A5A6",
      }))
      .sort((a, b) => b.avgReach - a.avgReach)
  }, [posts, categoryMap, categories])

  const fmt = (v: number | null | undefined) =>
    v != null ? v.toLocaleString("zh-TW") : "--"

  const truncate = (text: string | null, len: number) => {
    if (!text) return "--"
    return text.length > len ? text.slice(0, len) + "..." : text
  }

  const toggleSelectAll = () => {
    if (selectedPosts.size === sorted.length) {
      setSelectedPosts(new Set())
    } else {
      setSelectedPosts(new Set(sorted.map((p) => p.id)))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedPosts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleMonthCollapse = (monthKey: string) => {
    setCollapsedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(monthKey)) next.delete(monthKey)
      else next.add(monthKey)
      return next
    })
  }

  const applyBatchCategory = async () => {
    if (!batchCategory || selectedPosts.size === 0) return
    const supabase = createClient()
    const ids = Array.from(selectedPosts)
    await supabase
      .from("posts")
      .update({ category_id: batchCategory })
      .in("id", ids)
    // Refresh
    setPosts((prev) =>
      prev.map((p) =>
        ids.includes(p.id) ? { ...p, category_id: batchCategory } : p
      )
    )
    setSelectedPosts(new Set())
    setBatchCategory("")
  }

  const getWeekday = (dateStr: string) => {
    const d = new Date(dateStr)
    return WEEKDAYS[d.getDay()]
  }

  const getClickRate = (post: PostRow) => {
    if (post.link_clicks == null || post.organic_reach == null || post.organic_reach === 0)
      return null
    return (post.link_clicks / post.organic_reach) * 100
  }

  const renderPostRow = (post: PostRow) => {
    const cat = post.category_id ? categoryMap.get(post.category_id) : null
    const clickRate = getClickRate(post)
    return (
      <TableRow key={post.id}>
        <TableCell>
          <input
            type="checkbox"
            checked={selectedPosts.has(post.id)}
            onChange={() => toggleSelect(post.id)}
            className="accent-[var(--brand-gold)]"
          />
        </TableCell>
        <TableCell className="tabular-nums text-sm">
          {new Date(post.published_at).toLocaleDateString("zh-TW")}
        </TableCell>
        <TableCell className="text-sm">{getWeekday(post.published_at)}</TableCell>
        <TableCell>
          <Badge
            variant="secondary"
            className={
              post.platform === "facebook"
                ? "text-[var(--fb-blue)]"
                : "text-[var(--ig-pink)]"
            }
          >
            {post.platform === "facebook" ? "FB" : "IG"}
          </Badge>
        </TableCell>
        <TableCell className="max-w-[200px]">
          <span className="line-clamp-2 text-sm">{truncate(post.message, 60)}</span>
        </TableCell>
        <TableCell>
          {cat ? (
            <span
              className="inline-block rounded px-2 py-0.5 text-xs text-white"
              style={{ backgroundColor: cat.color }}
            >
              {cat.name}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">未分類</span>
          )}
        </TableCell>
        <TableCell className="text-right tabular-nums text-sm">
          {post.reach_w1 != null ? fmt(post.reach_w1) : (
            <span className="text-muted-foreground">待接入</span>
          )}
        </TableCell>
        <TableCell className="text-right tabular-nums text-sm">
          {post.reach_w2 != null ? fmt(post.reach_w2) : (
            <span className="text-muted-foreground">待接入</span>
          )}
        </TableCell>
        <TableCell className="text-right tabular-nums font-semibold text-sm">
          {fmt(post.organic_reach)}
        </TableCell>
        <TableCell className="text-right tabular-nums text-sm">
          {fmt(post.total_engagement)}
        </TableCell>
        <TableCell className="text-right tabular-nums text-sm">
          {fmt(post.link_clicks)}
        </TableCell>
        <TableCell className="text-right tabular-nums text-sm">
          {clickRate != null ? `${clickRate.toFixed(2)}%` : "--"}
        </TableCell>
      </TableRow>
    )
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-vertical:h-4" />
        <h1 className="text-lg font-semibold">貼文分析</h1>
      </header>
      <div className="flex flex-1 flex-col gap-6 px-6 pb-6">
        {loading ? (
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">
            載入中...
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="flex h-[300px] flex-col items-center justify-center gap-2 text-muted-foreground">
              <p className="text-lg font-medium">尚無貼文資料</p>
              <p className="text-sm">
                待 Meta API 串接後，貼文資料將自動匯入。
              </p>
              <div className="mt-4">
                <p className="text-sm font-medium">已設定的貼文分類：</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <Badge
                      key={cat.id}
                      variant="secondary"
                      style={{ borderLeftColor: cat.color, borderLeftWidth: 3 }}
                    >
                      {cat.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Top 5 Post Cards */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">本期 Top 5 貼文</CardTitle>
                  <div className="flex gap-1">
                    {["all", "facebook", "instagram"].map((p) => (
                      <button
                        key={p}
                        onClick={() => setPlatformFilter(p)}
                        className={`rounded px-2.5 py-0.5 text-xs transition-colors ${
                          platformFilter === p
                            ? "bg-foreground text-background"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {p === "all" ? "全部" : p === "facebook" ? "FB" : "IG"}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {top5.map((post, i) => {
                    const cat = post.category_id ? categoryMap.get(post.category_id) : null
                    return (
                      <div
                        key={post.id}
                        className="relative rounded-lg border bg-card p-3"
                      >
                        <div className="absolute -top-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-gold)] text-xs font-bold text-white">
                          {i + 1}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm font-medium">
                          {truncate(post.message, 40)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(post.published_at).toLocaleDateString("zh-TW")}
                          {" | "}
                          <span
                            className={
                              post.platform === "facebook"
                                ? "text-[var(--fb-blue)]"
                                : "text-[var(--ig-pink)]"
                            }
                          >
                            {post.platform === "facebook" ? "FB" : "IG"}
                          </span>
                          {cat && ` | ${cat.name}`}
                        </p>
                        <p className="mt-2 text-lg font-bold tabular-nums">
                          {fmt(post.organic_reach)}
                          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                            累積
                          </span>
                        </p>
                        <p className="text-sm font-semibold tabular-nums">
                          互動 {fmt(post.total_engagement)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Filters + Table */}
            <Card>
              {/* Filter bar */}
              <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">平台</span>
                  <NativeSelect value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="w-[100px]">
                    <option value="all">全部</option>
                    <option value="facebook">FB</option>
                    <option value="instagram">IG</option>
                  </NativeSelect>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">分類</span>
                  <NativeSelect value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-[120px]">
                    <option value="all">全部分類</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </NativeSelect>
                </div>

                <Separator orientation="vertical" className="data-vertical:h-6" />

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">排序</span>
                  <NativeSelect value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-[100px]">
                    <option value="reach">觸及數</option>
                    <option value="engagement">互動數</option>
                    <option value="date">日期</option>
                    <option value="month">月份</option>
                  </NativeSelect>
                </div>
              </div>

              {/* Batch actions */}
              <div className="flex items-center gap-3 border-b px-4 py-2 bg-muted/30">
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedPosts.size === sorted.length && sorted.length > 0}
                    onChange={toggleSelectAll}
                    className="accent-[var(--brand-gold)]"
                  />
                  全選
                </label>
                <NativeSelect value={batchCategory} onChange={(e) => setBatchCategory(e.target.value)} className="w-[120px] h-8">
                  <option value="">選擇分類</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </NativeSelect>
                <button
                  onClick={applyBatchCategory}
                  disabled={!batchCategory || selectedPosts.size === 0}
                  className="rounded bg-[var(--brand-gold)] px-3 py-1 text-sm text-white disabled:opacity-40"
                >
                  批次套用分類
                </button>
                {selectedPosts.size > 0 && (
                  <span className="text-xs text-muted-foreground">
                    已選 {selectedPosts.size} 篇
                  </span>
                )}
              </div>

              {/* Post table */}
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30px]" />
                        <TableHead>
                          日期 <SourceBadge type="auto" />
                        </TableHead>
                        <TableHead>星期</TableHead>
                        <TableHead>平台</TableHead>
                        <TableHead className="min-w-[160px]">
                          貼文主題 <SourceBadge type="auto" />
                        </TableHead>
                        <TableHead>
                          分類 <SourceBadge type="manual" />
                        </TableHead>
                        <TableHead className="text-right text-xs">
                          W1（7天）
                        </TableHead>
                        <TableHead className="text-right text-xs">
                          W2（14天）
                        </TableHead>
                        <TableHead className="text-right text-xs">累積</TableHead>
                        <TableHead className="text-right">
                          總互動 <SourceBadge type="auto" />
                        </TableHead>
                        <TableHead className="text-right">
                          連結點擊 <SourceBadge type="auto" />
                        </TableHead>
                        <TableHead className="text-right">
                          點擊率 <SourceBadge type="calc" />
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortBy === "month" && monthGroups
                        ? monthGroups.order.map((monthKey) => {
                            const monthPosts = monthGroups.groups.get(monthKey)!
                            const totalReach = monthPosts.reduce(
                              (s, p) => s + (p.organic_reach ?? 0),
                              0
                            )
                            const totalEng = monthPosts.reduce(
                              (s, p) => s + (p.total_engagement ?? 0),
                              0
                            )
                            const [y, m] = monthKey.split("-")
                            const label = `${y} 年 ${parseInt(m)} 月`
                            const isCollapsed = collapsedMonths.has(monthKey)

                            return (
                              <MonthGroupRows
                                key={monthKey}
                                label={label}
                                postCount={monthPosts.length}
                                totalReach={totalReach}
                                totalEng={totalEng}
                                avgReach={Math.round(totalReach / monthPosts.length)}
                                isCollapsed={isCollapsed}
                                onToggle={() => toggleMonthCollapse(monthKey)}
                                fmt={fmt}
                              >
                                {monthPosts.map((post) => renderPostRow(post))}
                              </MonthGroupRows>
                            )
                          })
                        : sorted.map((post) => renderPostRow(post))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Category Performance Chart */}
            {categoryChartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>分類平均觸及表現</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      data={categoryChartData}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v: number) =>
                          v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)
                        }
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tick={{ fontSize: 12 }}
                        width={70}
                      />
                      <Tooltip
                        formatter={(value) => [
                          `平均觸及：${Number(value).toLocaleString("zh-TW")}`,
                        ]}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          backgroundColor: "var(--card)",
                        }}
                      />
                      <Bar dataKey="avgReach" radius={[0, 4, 4, 0]}>
                        {categoryChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  )
}

function MonthGroupRows({
  label,
  postCount,
  totalReach,
  totalEng,
  avgReach,
  isCollapsed,
  onToggle,
  fmt,
  children,
}: {
  label: string
  postCount: number
  totalReach: number
  totalEng: number
  avgReach: number
  isCollapsed: boolean
  onToggle: () => void
  fmt: (v: number | null | undefined) => string
  children: React.ReactNode
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer bg-muted/30 hover:bg-muted/50"
        onClick={onToggle}
      >
        <TableCell colSpan={12} className="font-semibold">
          <span className="mr-1">{isCollapsed ? "\u25b6" : "\u25bc"}</span>
          {label}
          <span className="ml-3 text-xs font-normal text-muted-foreground">
            {postCount} 篇 | 觸及 {fmt(totalReach)} | 互動 {fmt(totalEng)} | 篇均觸及{" "}
            {fmt(avgReach)}
          </span>
        </TableCell>
      </TableRow>
      {!isCollapsed && children}
    </>
  )
}

function SourceBadge({ type }: { type: "auto" | "calc" | "manual" }) {
  const label = type === "auto" ? "自動" : type === "calc" ? "計算" : "手動"
  const color =
    type === "auto"
      ? "bg-green-100 text-green-700"
      : type === "calc"
        ? "bg-blue-100 text-blue-700"
        : "bg-amber-100 text-amber-700"
  return (
    <span
      className={`ml-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight align-middle ${color}`}
    >
      {label}
    </span>
  )
}
