"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
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

type WeeklyRow = {
  platform: string
  year: number
  week: number
  week_start: string
  reach: number | null
  new_followers: number | null
  engagement: number | null
}

type Goal = {
  platform: string
  metric: string
  pic: string
  weekly_target: number | null
  monthly_target: number | null
  quarterly_target: number | null
  annual_target: number | null
  goal_source: string
}

const DEMO_WS = "00000000-0000-0000-0000-000000000001"

export default function WeeklyPage() {
  const { activeWorkspace } = useWorkspace()
  const wsId = activeWorkspace?.id ?? DEMO_WS

  const [rows, setRows] = useState<WeeklyRow[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()
    setLoading(true)

    const fetchWeekly = supabase
      .from("weekly_metrics")
      .select("platform, year, week, week_start, reach, new_followers, engagement")
      .eq("workspace_id", wsId)
      .order("week_start", { ascending: false })

    const fetchGoals = supabase
      .from("goals")
      .select("platform, metric, pic, weekly_target, monthly_target, quarterly_target, annual_target, goal_source")
      .eq("workspace_id", wsId)
      .eq("year", new Date().getFullYear())

    Promise.all([fetchWeekly, fetchGoals]).then(([weeklyRes, goalsRes]) => {
      const weeklyData = weeklyRes.data ?? []
      setRows(weeklyData)
      setGoals(goalsRes.data ?? [])

      // Auto-expand current month
      const latestWeek = weeklyData[0]
      if (latestWeek) {
        const d = new Date(latestWeek.week_start)
        const monthKey = `${d.getMonth() + 1}`
        setExpandedMonths(new Set([monthKey]))
      }

      setLoading(false)
    })
  }, [wsId])

  // Goal lookup
  const getGoal = useCallback(
    (platform: string, metric: string) =>
      goals.find((g) => g.platform === platform && g.metric === metric),
    [goals]
  )

  // Split by platform
  const fbRows = useMemo(() => rows.filter((r) => r.platform === "facebook"), [rows])
  const igRows = useMemo(() => rows.filter((r) => r.platform === "instagram"), [rows])

  // Group weeks by month (from week_start date)
  const groupByMonth = useCallback((platformRows: WeeklyRow[]) => {
    const map = new Map<string, WeeklyRow[]>()
    const order: string[] = []
    // Sort ascending first to build groups in order
    const sorted = [...platformRows].sort(
      (a, b) => new Date(a.week_start).getTime() - new Date(b.week_start).getTime()
    )
    for (const row of sorted) {
      const d = new Date(row.week_start)
      const monthKey = `${d.getMonth() + 1}`
      if (!map.has(monthKey)) {
        map.set(monthKey, [])
        order.push(monthKey)
      }
      map.get(monthKey)!.push(row)
    }
    // Reverse order so newest month first
    return { map, order: order.reverse() }
  }, [])

  const fbGrouped = useMemo(() => groupByMonth(fbRows), [groupByMonth, fbRows])
  const igGrouped = useMemo(() => groupByMonth(igRows), [groupByMonth, igRows])

  // Current month detection (from latest data)
  const currentMonthNum = useMemo(() => {
    const latest = rows[0]
    if (!latest) return new Date().getMonth() + 1
    return new Date(latest.week_start).getMonth() + 1
  }, [rows])

  // Monthly totals for current month
  const getMonthlyTotals = useCallback(
    (platformRows: WeeklyRow[]) => {
      const currentMonthRows = platformRows.filter((r) => {
        const d = new Date(r.week_start)
        return d.getMonth() + 1 === currentMonthNum
      })
      return {
        reach: currentMonthRows.reduce((s, r) => s + (r.reach ?? 0), 0),
        followers: currentMonthRows.reduce((s, r) => s + (r.new_followers ?? 0), 0),
        weekCount: currentMonthRows.length,
      }
    },
    [currentMonthNum]
  )

  // Quarter progress (Q1=W1-W13, Q2=W14-W26, Q3=W27-W39, Q4=W40-W52)
  const currentQuarter = Math.ceil(currentMonthNum / 3)
  const quarterStartWeek = (currentQuarter - 1) * 13 + 1
  const quarterEndWeek = currentQuarter * 13

  const getQuarterTotals = useCallback(
    (platformRows: WeeklyRow[]) => {
      const qRows = platformRows.filter(
        (r) => r.week >= quarterStartWeek && r.week <= quarterEndWeek
      )
      return {
        reach: qRows.reduce((s, r) => s + (r.reach ?? 0), 0),
        followers: qRows.reduce((s, r) => s + (r.new_followers ?? 0), 0),
        weeksElapsed: qRows.length,
      }
    },
    [quarterStartWeek, quarterEndWeek]
  )

  const toggleMonth = (platform: string, monthKey: string) => {
    const key = `${platform}-${monthKey}`
    setExpandedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Re-initialize expanded months when currentMonthNum changes
  useEffect(() => {
    setExpandedMonths(new Set([`fb-${currentMonthNum}`, `ig-${currentMonthNum}`]))
  }, [currentMonthNum])

  const fmt = (v: number | null | undefined) =>
    v != null ? v.toLocaleString("zh-TW") : "--"

  const progressColor = (pct: number) =>
    pct >= 100 ? "bg-green-500" : pct >= 80 ? "bg-orange-400" : "bg-red-500"
  const progressTextColor = (pct: number) =>
    pct >= 100 ? "text-green-600" : pct >= 80 ? "text-orange-500" : "text-red-500"
  const rateColor = (pct: number) =>
    pct >= 100 ? "text-green-600" : pct >= 80 ? "text-orange-500" : "text-red-500"

  if (loading) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-vertical:h-4" />
          <h1 className="text-lg font-semibold">週報追蹤</h1>
        </header>
        <div className="flex h-[400px] items-center justify-center text-muted-foreground">
          載入中...
        </div>
      </>
    )
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-vertical:h-4" />
        <h1 className="text-lg font-semibold">週報追蹤</h1>
      </header>
      <div className="flex flex-1 flex-col gap-6 px-6 pb-6">
        {/* === FB Section === */}
        <PlatformSection
          platform="facebook"
          label="Facebook"
          owner={getGoal("facebook", "reach")?.pic ?? "Clara Chang"}
          rows={fbRows}
          grouped={fbGrouped}
          reachGoal={getGoal("facebook", "reach")}
          followGoal={getGoal("facebook", "followers")}
          currentMonthNum={currentMonthNum}
          expandedMonths={expandedMonths}
          toggleMonth={toggleMonth}
          getMonthlyTotals={getMonthlyTotals}
          getQuarterTotals={getQuarterTotals}
          currentQuarter={currentQuarter}
          fmt={fmt}
          progressColor={progressColor}
          progressTextColor={progressTextColor}
          rateColor={rateColor}
          showEngagement={false}
        />

        {/* === IG Section === */}
        <PlatformSection
          platform="instagram"
          label="Instagram"
          owner={getGoal("instagram", "reach")?.pic ?? "Mike Chen"}
          rows={igRows}
          grouped={igGrouped}
          reachGoal={getGoal("instagram", "reach")}
          followGoal={getGoal("instagram", "followers")}
          currentMonthNum={currentMonthNum}
          expandedMonths={expandedMonths}
          toggleMonth={toggleMonth}
          getMonthlyTotals={getMonthlyTotals}
          getQuarterTotals={getQuarterTotals}
          currentQuarter={currentQuarter}
          fmt={fmt}
          progressColor={progressColor}
          progressTextColor={progressTextColor}
          rateColor={rateColor}
          showEngagement={true}
        />

        {/* === Monthly Summary === */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              月度彙總
              <SourceBadge type="calc" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>月份</TableHead>
                    <TableHead className="text-right">FB 觸及</TableHead>
                    <TableHead className="text-right">FB 追蹤</TableHead>
                    <TableHead className="text-right">IG 觸及</TableHead>
                    <TableHead className="text-right">IG 追蹤</TableHead>
                    <TableHead className="text-right">週數</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    // Combine FB and IG month groups
                    const allMonthKeys = new Set<string>()
                    fbGrouped.order.forEach((k) => allMonthKeys.add(k))
                    igGrouped.order.forEach((k) => allMonthKeys.add(k))
                    const sortedMonths = [...allMonthKeys].sort(
                      (a, b) => Number(b) - Number(a)
                    )

                    return sortedMonths.map((monthKey) => {
                      const fbWeeks = fbGrouped.map.get(monthKey) ?? []
                      const igWeeks = igGrouped.map.get(monthKey) ?? []
                      const isCurrent = Number(monthKey) === currentMonthNum
                      return (
                        <TableRow
                          key={monthKey}
                          className={isCurrent ? "bg-amber-50 font-semibold" : ""}
                        >
                          <TableCell>
                            {monthKey}月{isCurrent ? " 📍" : ""}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmt(fbWeeks.reduce((s, w) => s + (w.reach ?? 0), 0))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmt(fbWeeks.reduce((s, w) => s + (w.new_followers ?? 0), 0))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmt(igWeeks.reduce((s, w) => s + (w.reach ?? 0), 0))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmt(igWeeks.reduce((s, w) => s + (w.new_followers ?? 0), 0))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {Math.max(fbWeeks.length, igWeeks.length)}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  })()}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

// ===== Platform Section Component =====
function PlatformSection({
  platform,
  label,
  owner,
  rows,
  grouped,
  reachGoal,
  followGoal,
  currentMonthNum,
  expandedMonths,
  toggleMonth,
  getMonthlyTotals,
  getQuarterTotals,
  currentQuarter,
  fmt,
  progressColor,
  progressTextColor,
  rateColor,
  showEngagement,
}: {
  platform: string
  label: string
  owner: string
  rows: WeeklyRow[]
  grouped: { map: Map<string, WeeklyRow[]>; order: string[] }
  reachGoal: Goal | undefined
  followGoal: Goal | undefined
  currentMonthNum: number
  expandedMonths: Set<string>
  toggleMonth: (platform: string, monthKey: string) => void
  getMonthlyTotals: (rows: WeeklyRow[]) => { reach: number; followers: number; weekCount: number }
  getQuarterTotals: (rows: WeeklyRow[]) => { reach: number; followers: number; weeksElapsed: number }
  currentQuarter: number
  fmt: (v: number | null | undefined) => string
  progressColor: (pct: number) => string
  progressTextColor: (pct: number) => string
  rateColor: (pct: number) => string
  showEngagement: boolean
}) {
  const weeklyReachTarget = reachGoal?.weekly_target ?? 0
  const weeklyFollowTarget = followGoal?.weekly_target ?? 0
  const monthlyReachTarget = reachGoal?.monthly_target ?? 0
  const monthlyFollowTarget = followGoal?.monthly_target ?? 0
  const quarterlyReachTarget = reachGoal?.quarterly_target ?? 0

  const monthTotals = getMonthlyTotals(rows)
  const quarterTotals = getQuarterTotals(rows)

  const monthReachPct = monthlyReachTarget > 0 ? Math.round((monthTotals.reach / monthlyReachTarget) * 100) : 0
  const monthFollowPct = monthlyFollowTarget > 0 ? Math.round((monthTotals.followers / monthlyFollowTarget) * 100) : 0

  const reachGap = monthlyReachTarget - monthTotals.reach
  const followGap = monthlyFollowTarget - monthTotals.followers
  const remainWeeks = Math.max(1, 4 - monthTotals.weekCount)

  // Q pace projection
  const qReachPct = quarterlyReachTarget > 0 ? Math.round((quarterTotals.reach / quarterlyReachTarget) * 100) : 0
  const qProjected = quarterTotals.weeksElapsed > 0 ? Math.round((quarterTotals.reach / quarterTotals.weeksElapsed) * 13) : 0
  const qProjectedPct = quarterlyReachTarget > 0 ? Math.round((qProjected / quarterlyReachTarget) * 100) : 0

  const isFb = platform === "facebook"
  const platformKey = isFb ? "fb" : "ig"
  const badgeColor = isFb ? "bg-[var(--fb-blue)] text-white" : "bg-[var(--ig-pink)] text-white"

  const goalSourceLabel = reachGoal?.goal_source === "simulator" ? "模擬器設定" : reachGoal?.goal_source === "manual" ? "手動編輯" : "預設值"

  return (
    <Card>
      {/* Section Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Badge className={badgeColor}>{isFb ? "FB" : "IG"}</Badge>
          <CardTitle className="text-base">{label}</CardTitle>
          <span className="ml-auto text-sm text-muted-foreground">
            負責人：{owner}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Weekly data table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>週次</TableHead>
                <TableHead className="text-right">
                  自然觸及 <SourceBadge type="auto" />
                </TableHead>
                <TableHead className="text-right">
                  達成率 <SourceBadge type="calc" />
                </TableHead>
                <TableHead className="text-right">
                  新增淨追蹤 <SourceBadge type="auto" />
                </TableHead>
                <TableHead className="text-right">
                  達成率 <SourceBadge type="calc" />
                </TableHead>
                {showEngagement && (
                  <TableHead className="text-right">
                    互動數 <SourceBadge type="auto" />
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Target row */}
              <TableRow className="bg-green-50">
                <TableCell className="font-semibold">
                  🎯 週目標 <SourceBadge type="manual" />
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {fmt(weeklyReachTarget)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">--</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {fmt(weeklyFollowTarget)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">--</TableCell>
                {showEngagement && (
                  <TableCell className="text-right text-muted-foreground">--</TableCell>
                )}
              </TableRow>
              {/* Goal source note */}
              <TableRow className="border-b-2">
                <TableCell
                  colSpan={showEngagement ? 6 : 5}
                  className="text-xs text-muted-foreground py-1"
                >
                  月目標 {fmt(monthlyReachTarget)} 觸及 / {fmt(monthlyFollowTarget)} 追蹤
                  {" | "}季目標 {fmt(quarterlyReachTarget)} 觸及
                  {" | "}
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      goalSourceLabel === "模擬器設定"
                        ? "bg-amber-100 text-amber-700"
                        : goalSourceLabel === "手動編輯"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    來源：{goalSourceLabel}
                  </span>
                </TableCell>
              </TableRow>

              {/* Grouped week rows */}
              {grouped.order.map((monthKey) => {
                const weeks = grouped.map.get(monthKey)!
                const isCurrent = Number(monthKey) === currentMonthNum
                const expandKey = `${platformKey}-${monthKey}`
                const isExpanded = expandedMonths.has(expandKey)

                const totalReach = weeks.reduce((s, w) => s + (w.reach ?? 0), 0)
                const totalFollow = weeks.reduce((s, w) => s + (w.new_followers ?? 0), 0)

                return (
                  <MonthGroup
                    key={monthKey}
                    monthKey={monthKey}
                    isCurrent={isCurrent}
                    isExpanded={isExpanded}
                    onToggle={() => toggleMonth(platformKey, monthKey)}
                    totalReach={totalReach}
                    totalFollow={totalFollow}
                    weekCount={weeks.length}
                    colSpan={showEngagement ? 6 : 5}
                    fmt={fmt}
                  >
                    {/* Sort weeks newest first within group */}
                    {[...weeks]
                      .sort((a, b) => b.week - a.week)
                      .map((w) => {
                        const reachRate =
                          w.reach != null && weeklyReachTarget > 0
                            ? Math.round((w.reach / weeklyReachTarget) * 100)
                            : null
                        const followRate =
                          w.new_followers != null && weeklyFollowTarget > 0
                            ? Math.round((w.new_followers / weeklyFollowTarget) * 100)
                            : null
                        return (
                          <TableRow key={w.week}>
                            <TableCell>
                              W{w.week}
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({w.week_start})
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmt(w.reach)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {reachRate != null ? (
                                <span className={`font-semibold ${rateColor(reachRate)}`}>
                                  {reachRate}%
                                </span>
                              ) : (
                                "--"
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmt(w.new_followers)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {followRate != null ? (
                                <span className={`font-semibold ${rateColor(followRate)}`}>
                                  {followRate}%
                                </span>
                              ) : (
                                "--"
                              )}
                            </TableCell>
                            {showEngagement && (
                              <TableCell className="text-right tabular-nums">
                                {fmt(w.engagement)}
                              </TableCell>
                            )}
                          </TableRow>
                        )
                      })}
                  </MonthGroup>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {/* Monthly progress cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ProgressCard
            title={`${currentMonthNum}月目標進度 — 自然觸及`}
            actual={monthTotals.reach}
            target={monthlyReachTarget}
            pct={monthReachPct}
            gap={reachGap}
            remainWeeks={remainWeeks}
            weeklyTarget={weeklyReachTarget}
            fmt={fmt}
            progressColor={progressColor}
            progressTextColor={progressTextColor}
          />
          <ProgressCard
            title={`${currentMonthNum}月目標進度 — 新增追蹤`}
            actual={monthTotals.followers}
            target={monthlyFollowTarget}
            pct={monthFollowPct}
            gap={followGap}
            remainWeeks={remainWeeks}
            weeklyTarget={weeklyFollowTarget}
            fmt={fmt}
            progressColor={progressColor}
            progressTextColor={progressTextColor}
          />
        </div>

        {/* Q pace projection */}
        <div className="rounded-lg bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
          目前 Q{currentQuarter} 進度 {qReachPct}%，按此速度預估季末達成{" "}
          {qProjectedPct}%（預估 {fmt(qProjected)} / 目標 {fmt(quarterlyReachTarget)}）
        </div>
      </CardContent>
    </Card>
  )
}

// ===== Month Group with collapse/expand =====
function MonthGroup({
  monthKey,
  isCurrent,
  isExpanded,
  onToggle,
  totalReach,
  totalFollow,
  weekCount,
  colSpan,
  fmt,
  children,
}: {
  monthKey: string
  isCurrent: boolean
  isExpanded: boolean
  onToggle: () => void
  totalReach: number
  totalFollow: number
  weekCount: number
  colSpan: number
  fmt: (v: number | null | undefined) => string
  children: React.ReactNode
}) {
  return (
    <>
      <TableRow
        className={`cursor-pointer hover:bg-muted/50 ${
          isCurrent ? "bg-amber-50 border-l-4 border-l-[var(--brand-gold)]" : "bg-muted/30"
        }`}
        onClick={onToggle}
      >
        <TableCell colSpan={colSpan} className="font-semibold">
          <span className="mr-1">{isExpanded ? "\u25bc" : "\u25b6"}</span>
          2026 年 {monthKey}月{isCurrent ? " 📍" : ""}
          <span className="ml-3 text-xs font-normal text-muted-foreground">
            {weekCount} 週 | 觸及 {fmt(totalReach)} | 追蹤 +{fmt(totalFollow)}
          </span>
        </TableCell>
      </TableRow>
      {isExpanded && children}
    </>
  )
}

// ===== Progress Card =====
function ProgressCard({
  title,
  actual,
  target,
  pct,
  gap,
  remainWeeks,
  weeklyTarget,
  fmt,
  progressColor,
  progressTextColor,
}: {
  title: string
  actual: number
  target: number
  pct: number
  gap: number
  remainWeeks: number
  weeklyTarget: number
  fmt: (v: number | null | undefined) => string
  progressColor: (pct: number) => string
  progressTextColor: (pct: number) => string
}) {
  return (
    <div className="rounded-lg bg-muted/30 p-4">
      <p className="text-xs font-semibold text-muted-foreground mb-1">{title}</p>
      <p className="text-2xl font-bold tabular-nums">{fmt(actual)}</p>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-2 flex-1 rounded-full bg-muted">
          <div
            className={`h-2 rounded-full transition-all ${progressColor(pct)}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <span className={`text-xs font-semibold ${progressTextColor(pct)}`}>
          {pct}%
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        目標{" "}
        <span className="font-semibold text-foreground">{fmt(target)}</span>
        <span className="text-[10px] text-muted-foreground ml-1">
          = 週目標 {fmt(weeklyTarget)} x 4
        </span>
      </p>
      {gap > 0 ? (
        <p className="mt-1 text-[11px] text-red-500">
          差 {fmt(gap)}，剩 {remainWeeks} 週需每週 {fmt(Math.ceil(gap / remainWeeks))}
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-green-600">
          ✓ 本月已達成
        </p>
      )}
    </div>
  )
}

// ===== Source Badge =====
function SourceBadge({ type }: { type: "auto" | "calc" | "manual" }) {
  const label = type === "auto" ? "自動" : type === "calc" ? "計算" : "手動"
  const color =
    type === "auto"
      ? "bg-green-100 text-green-700"
      : type === "calc"
        ? "bg-blue-100 text-blue-700"
        : "bg-amber-100 text-amber-700"
  return (
    <span className={`ml-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight align-middle ${color}`}>
      {label}
    </span>
  )
}
