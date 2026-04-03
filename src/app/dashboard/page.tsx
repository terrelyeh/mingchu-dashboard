"use client"

import { useEffect, useState, useMemo } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

type MonthRow = {
  platform: string
  year: number
  month: number
  reach_total: number | null
  new_followers: number | null
  engagement: number | null
}

type FanSnapshot = {
  year: number
  facebook: number
  instagram: number
  total: number
}

type Goal = {
  platform: string
  metric: string
  weekly_target: number | null
  annual_target: number | null
}

const DEMO_WS = "00000000-0000-0000-0000-000000000001"

export default function OverviewPage() {
  const { activeWorkspace, setWorkspaces } = useWorkspace()
  const [monthlyData, setMonthlyData] = useState<MonthRow[]>([])
  const [fans, setFans] = useState<FanSnapshot[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart")

  const wsId = activeWorkspace?.id ?? DEMO_WS

  // Load workspaces on mount
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("workspaces")
      .select("id, name, description")
      .then(({ data }) => {
        if (data && data.length > 0) setWorkspaces(data)
      })
  }, [setWorkspaces])

  // Fetch all data
  useEffect(() => {
    const supabase = createClient()
    setLoading(true)

    const fetchMonthly = supabase
      .from("monthly_summary")
      .select("platform, year, month, reach_total, new_followers, engagement")
      .eq("workspace_id", wsId)
      .order("year", { ascending: false })
      .order("month", { ascending: false })

    const fetchFans = supabase
      .from("follower_snapshots")
      .select("platform, date, follower_count")
      .eq("workspace_id", wsId)
      .order("date", { ascending: true })

    const fetchGoals = supabase
      .from("goals")
      .select("platform, metric, weekly_target, annual_target")
      .eq("workspace_id", wsId)
      .eq("year", new Date().getFullYear())

    Promise.all([fetchMonthly, fetchFans, fetchGoals]).then(
      ([monthlyRes, fansRes, goalsRes]) => {
        setMonthlyData(monthlyRes.data ?? [])
        setGoals(goalsRes.data ?? [])

        // Build yearly fan data
        if (fansRes.data) {
          const byYear = new Map<number, { facebook: number; instagram: number }>()
          for (const row of fansRes.data) {
            const year = new Date(row.date).getFullYear()
            if (!byYear.has(year))
              byYear.set(year, { facebook: 0, instagram: 0 })
            const entry = byYear.get(year)!
            if (row.platform === "facebook")
              entry.facebook = row.follower_count
            else if (row.platform === "instagram")
              entry.instagram = row.follower_count
          }
          setFans(
            Array.from(byYear.entries()).map(([year, d]) => ({
              year,
              facebook: d.facebook,
              instagram: d.instagram,
              total: d.facebook + d.instagram,
            }))
          )
        }
        setLoading(false)
      }
    )
  }, [wsId])

  // Find latest month with data
  const latestMonth = useMemo(() => {
    if (monthlyData.length === 0) return null
    return { year: monthlyData[0].year, month: monthlyData[0].month }
  }, [monthlyData])

  // Get month data helper
  const getMonthSum = (year: number, month: number) => {
    const rows = monthlyData.filter(
      (r) => r.year === year && r.month === month
    )
    if (rows.length === 0) return null
    return {
      reach: rows.reduce((s, r) => s + (r.reach_total ?? 0), 0),
      followers: rows.reduce((s, r) => s + (r.new_followers ?? 0), 0),
      engagement: rows.reduce((s, r) => s + (r.engagement ?? 0), 0),
      hasEngagement: rows.some((r) => r.engagement != null),
    }
  }

  // KPI calculations
  const kpi = useMemo(() => {
    if (!latestMonth) return null
    const { year, month } = latestMonth
    const curr = getMonthSum(year, month)

    // Previous month
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const prev = getMonthSum(prevYear, prevMonth)

    // YoY
    const yoy = getMonthSum(year - 1, month)

    const momReach =
      curr && prev && prev.reach > 0
        ? ((curr.reach - prev.reach) / prev.reach) * 100
        : null
    const yoyReach =
      curr && yoy && yoy.reach > 0
        ? ((curr.reach - yoy.reach) / yoy.reach) * 100
        : null
    const momFollowers =
      curr && prev && prev.followers > 0
        ? ((curr.followers - prev.followers) / prev.followers) * 100
        : null
    const yoyFollowers =
      curr && yoy && yoy.followers > 0
        ? ((curr.followers - yoy.followers) / yoy.followers) * 100
        : null

    // Total followers from latest fan snapshot
    const latestFan = fans.length > 0 ? fans[fans.length - 1] : null

    return {
      totalFollowers: latestFan?.total ?? null,
      fbFollowers: latestFan?.facebook ?? null,
      igFollowers: latestFan?.instagram ?? null,
      reach: curr?.reach ?? null,
      followers: curr?.followers ?? null,
      engagement: curr?.hasEngagement ? curr.engagement : null,
      momReach,
      yoyReach,
      momFollowers,
      yoyFollowers,
      label: `${year}/${String(month).padStart(2, "0")}`,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestMonth, monthlyData, fans])

  // YTD calculations
  const ytd = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const yearRows = monthlyData.filter((r) => r.year === currentYear)
    const months = new Set(yearRows.map((r) => r.month))
    const ytdReach = yearRows.reduce((s, r) => s + (r.reach_total ?? 0), 0)
    const ytdFollowers = yearRows.reduce(
      (s, r) => s + (r.new_followers ?? 0),
      0
    )

    // Annual goals (sum FB + IG weekly × 48)
    const annualReachGoal = goals.reduce((s, g) => {
      if (g.metric === "reach")
        return s + (g.annual_target ?? (g.weekly_target ?? 0) * 48)
      return s
    }, 0)
    const annualFollowGoal = goals.reduce((s, g) => {
      if (g.metric === "followers")
        return s + (g.annual_target ?? (g.weekly_target ?? 0) * 48)
      return s
    }, 0)

    const timePct = Math.round((months.size / 12) * 100)

    return {
      reach: ytdReach,
      followers: ytdFollowers,
      reachGoal: annualReachGoal,
      followGoal: annualFollowGoal,
      reachPct: annualReachGoal > 0 ? Math.round((ytdReach / annualReachGoal) * 100) : 0,
      followPct: annualFollowGoal > 0 ? Math.round((ytdFollowers / annualFollowGoal) * 100) : 0,
      timePct,
      monthCount: months.size,
    }
  }, [monthlyData, goals])

  // Fan growth table with growth rates
  const fanTable = useMemo(() => {
    return fans.map((d, i) => {
      const prev = i > 0 ? fans[i - 1] : null
      return {
        ...d,
        fbGrow: prev ? d.facebook - prev.facebook : null,
        fbRate: prev && prev.facebook > 0 ? Math.round(((d.facebook - prev.facebook) / prev.facebook) * 100) : null,
        igGrow: prev ? d.instagram - prev.instagram : null,
        igRate: prev && prev.instagram > 0 ? Math.round(((d.instagram - prev.instagram) / prev.instagram) * 100) : null,
        totalGrow: prev ? d.total - prev.total : null,
        totalRate: prev && prev.total > 0 ? Math.round(((d.total - prev.total) / prev.total) * 100) : null,
      }
    })
  }, [fans])

  // Chart data: line chart (FB + IG + 合計)
  const chartData = useMemo(
    () =>
      fans.map((d) => ({
        year: d.year,
        Facebook: d.facebook,
        Instagram: d.instagram,
        合計: d.total,
      })),
    [fans]
  )

  const fmt = (v: number | null | undefined) =>
    v != null ? v.toLocaleString("zh-TW") : "--"

  const progressColor = (pct: number, timePct: number) =>
    pct >= timePct ? "bg-green-500" : pct >= timePct * 0.8 ? "bg-yellow-400" : "bg-red-500"

  const changeBadge = (val: number | null | undefined, label: string) => {
    if (val == null) return <span className="text-xs text-muted-foreground">{label} --</span>
    const color = val > 0 ? "text-green-600 bg-green-50" : val < 0 ? "text-red-600 bg-red-50" : "text-muted-foreground bg-muted"
    return (
      <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${color}`}>
        {label} {val > 0 ? "+" : ""}{val.toFixed(1)}%
      </span>
    )
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-vertical:h-4" />
        <h1 className="text-lg font-semibold">總覽</h1>
      </header>
      <div className="flex flex-1 flex-col gap-6 px-6 pb-6">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* 粉絲總數 */}
          <Card className="border-l-4 border-l-[#6C5CE7]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                粉絲總數（FB + IG）
                <Badge variant="secondary" className="ml-1 text-[10px]">計算</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {loading ? "..." : fmt(kpi?.totalFollowers)}
              </div>
              {!loading && kpi && (
                <div className="mt-1 flex gap-1.5">
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-[var(--fb-blue)]">
                    FB {fmt(kpi.fbFollowers)}
                  </span>
                  <span className="rounded bg-pink-50 px-1.5 py-0.5 text-xs font-semibold text-[var(--ig-pink)]">
                    IG {fmt(kpi.igFollowers)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 本月觸及 */}
          <Card className="border-l-4 border-l-[var(--fb-blue)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                本月觸及（{kpi?.label ?? "--"}）
                <Badge variant="secondary" className="ml-1 text-[10px]">計算</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {loading ? "..." : fmt(kpi?.reach)}
              </div>
              {!loading && (
                <div className="mt-1 flex gap-1.5">
                  {changeBadge(kpi?.momReach, "MoM")}
                  {changeBadge(kpi?.yoyReach, "YoY")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 本月新增追蹤 */}
          <Card className="border-l-4 border-l-[var(--ig-pink)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                本月新增追蹤
                <Badge variant="secondary" className="ml-1 text-[10px]">計算</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {loading ? "..." : fmt(kpi?.followers)}
              </div>
              {!loading && (
                <div className="mt-1 flex gap-1.5">
                  {changeBadge(kpi?.momFollowers, "MoM")}
                  {changeBadge(kpi?.yoyFollowers, "YoY")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 本月互動 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                本月互動
                <Badge variant="secondary" className="ml-1 text-[10px]">計算</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {loading ? "..." : fmt(kpi?.engagement)}
              </div>
              {!loading && !kpi?.engagement && (
                <span className="text-xs text-muted-foreground">待接入完整數據</span>
              )}
            </CardContent>
          </Card>
        </div>

        {/* YTD Annual Progress */}
        {!loading && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border border-border">
              <CardContent className="pt-4">
                <div className="mb-1 text-xs font-semibold text-muted-foreground">
                  {new Date().getFullYear()} 年度累計觸及
                  <Badge variant="secondary" className="ml-1 text-[10px]">計算</Badge>
                </div>
                <div className="text-2xl font-bold tabular-nums">{fmt(ytd.reach)}</div>
                <div className="mt-2 h-2.5 w-full rounded-full bg-muted">
                  <div
                    className={`h-2.5 rounded-full transition-all ${progressColor(ytd.reachPct, ytd.timePct)}`}
                    style={{ width: `${Math.min(ytd.reachPct, 100)}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    年度目標 <strong className="text-foreground">{fmt(ytd.reachGoal)}</strong>
                  </span>
                  <span className="font-semibold">{ytd.reachPct}%</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  時間進度 {ytd.timePct}%（{ytd.monthCount}/12 月）
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardContent className="pt-4">
                <div className="mb-1 text-xs font-semibold text-muted-foreground">
                  {new Date().getFullYear()} 年度累計新增追蹤
                  <Badge variant="secondary" className="ml-1 text-[10px]">計算</Badge>
                </div>
                <div className="text-2xl font-bold tabular-nums">{fmt(ytd.followers)}</div>
                <div className="mt-2 h-2.5 w-full rounded-full bg-muted">
                  <div
                    className={`h-2.5 rounded-full transition-all ${progressColor(ytd.followPct, ytd.timePct)}`}
                    style={{ width: `${Math.min(ytd.followPct, 100)}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    年度目標 <strong className="text-foreground">{fmt(ytd.followGoal)}</strong>
                  </span>
                  <span className="font-semibold">{ytd.followPct}%</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  時間進度 {ytd.timePct}%（{ytd.monthCount}/12 月）
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Yearly Fan Growth (Chart/Table toggle) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>歷年粉絲成長趨勢</CardTitle>
              <div className="flex gap-1">
                <button
                  onClick={() => setViewMode("chart")}
                  className={`rounded-md border px-3 py-1 text-xs font-semibold transition-colors ${
                    viewMode === "chart"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card"
                  }`}
                >
                  圖表
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`rounded-md border px-3 py-1 text-xs font-semibold transition-colors ${
                    viewMode === "table"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card"
                  }`}
                >
                  表格
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-[350px] items-center justify-center text-muted-foreground">
                載入中...
              </div>
            ) : fans.length === 0 ? (
              <div className="flex h-[350px] items-center justify-center text-muted-foreground">
                尚無資料
              </div>
            ) : viewMode === "chart" ? (
              <ResponsiveContainer width="100%" height={380}>
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 13 }}
                    stroke="var(--muted-foreground)"
                  />
                  <YAxis
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)
                    }
                    tick={{ fontSize: 13 }}
                    stroke="var(--muted-foreground)"
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      Number(value).toLocaleString("zh-TW"),
                      name,
                    ]}
                    labelFormatter={(label) => `${label} 年`}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card)",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="Facebook"
                    stroke="#1877F2"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    fill="rgba(24,119,242,0.08)"
                  />
                  <Line
                    type="monotone"
                    dataKey="Instagram"
                    stroke="#E1306C"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    fill="rgba(225,48,108,0.08)"
                  />
                  <Line
                    type="monotone"
                    dataKey="合計"
                    stroke="#6C5CE7"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    fill="rgba(108,92,231,0.08)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>年份</TableHead>
                      <TableHead className="text-right">FB</TableHead>
                      <TableHead className="text-right">FB 成長數</TableHead>
                      <TableHead className="text-right">FB 成長率</TableHead>
                      <TableHead className="text-right">IG</TableHead>
                      <TableHead className="text-right">IG 成長數</TableHead>
                      <TableHead className="text-right">IG 成長率</TableHead>
                      <TableHead className="text-right font-bold">總粉絲數</TableHead>
                      <TableHead className="text-right">總成長數</TableHead>
                      <TableHead className="text-right">總成長率</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fanTable.map((d) => (
                      <TableRow key={d.year}>
                        <TableCell className="font-bold">{d.year}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(d.facebook)}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.fbGrow != null ? fmt(d.fbGrow) : "--"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {d.fbRate != null ? (
                            <span className={d.fbRate >= 0 ? "font-semibold text-green-600" : "font-semibold text-red-500"}>
                              {d.fbRate}%
                            </span>
                          ) : "--"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(d.instagram)}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.igGrow != null ? fmt(d.igGrow) : "--"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {d.igRate != null ? (
                            <span className={d.igRate >= 0 ? "font-semibold text-green-600" : "font-semibold text-red-500"}>
                              {d.igRate}%
                            </span>
                          ) : "--"}
                        </TableCell>
                        <TableCell className="text-right font-bold tabular-nums">{fmt(d.total)}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.totalGrow != null ? fmt(d.totalGrow) : "--"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {d.totalRate != null ? (
                            <span className={d.totalRate >= 0 ? "font-semibold text-green-600" : "font-semibold text-red-500"}>
                              {d.totalRate}%
                            </span>
                          ) : "--"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
