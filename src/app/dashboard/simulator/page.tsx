"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { NativeSelect } from "@/components/ui/native-select"
import { Slider } from "@/components/ui/slider"
import { useWorkspace } from "@/lib/workspace-context"
import { createClient } from "@/lib/supabase/client"
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

type MonthlyRow = {
  platform: string
  year: number
  month: number
  reach_organic: number | null
  reach_ad: number | null
  reach_total: number | null
  new_followers: number | null
  engagement: number | null
}

const DEMO_WS = "00000000-0000-0000-0000-000000000001"

const METRICS = [
  { id: "organic_reach", name: "自然觸及" },
  { id: "total_reach", name: "總觸及" },
  { id: "followers", name: "新增追蹤" },
  { id: "engagement", name: "互動數" },
]

const PRESETS = [
  { label: "保守", rate: 2 },
  { label: "穩健", rate: 5 },
  { label: "積極", rate: 10 },
  { label: "衝刺", rate: 15 },
  { label: "爆發", rate: 20 },
]

export default function SimulatorPage() {
  const { activeWorkspace } = useWorkspace()
  const wsId = activeWorkspace?.id ?? DEMO_WS

  const [allMonthly, setAllMonthly] = useState<MonthlyRow[]>([])
  const [loading, setLoading] = useState(true)

  // Simulator state
  const [metric, setMetric] = useState("organic_reach")
  const [platform, setPlatform] = useState("all")
  const [basePeriod, setBasePeriod] = useState("")
  const [growthRate, setGrowthRate] = useState(5)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    setLoading(true)
    supabase
      .from("monthly_summary")
      .select("platform, year, month, reach_organic, reach_ad, reach_total, new_followers, engagement")
      .eq("workspace_id", wsId)
      .then(({ data }) => {
        const rows = data ?? []
        setAllMonthly(rows)

        // Default base period: most recent month with data
        if (rows.length > 0) {
          const sorted = [...rows].sort(
            (a, b) => b.year - a.year || b.month - a.month
          )
          setBasePeriod(`${sorted[0].year}-${sorted[0].month - 1}`)
        }
        setLoading(false)
      })
  }, [wsId])

  // Available base periods (months with data)
  const basePeriods = useMemo(() => {
    const seen = new Set<string>()
    const periods: { year: number; month: number; label: string; value: string }[] = []
    for (const row of allMonthly) {
      const key = `${row.year}-${row.month}`
      if (!seen.has(key)) {
        seen.add(key)
        periods.push({
          year: row.year,
          month: row.month,
          label: `${row.year}/${row.month}月`,
          value: `${row.year}-${row.month - 1}`, // 0-indexed month for getMonthData
        })
      }
    }
    return periods.sort((a, b) => b.year - a.year || b.month - a.month)
  }, [allMonthly])

  // Get month data (month is 0-indexed)
  const getMonthData = useCallback(
    (plat: string, year: number, month: number) => {
      if (plat === "all") {
        const fb = allMonthly.find(
          (r) => r.platform === "facebook" && r.year === year && r.month === month + 1
        )
        const ig = allMonthly.find(
          (r) => r.platform === "instagram" && r.year === year && r.month === month + 1
        )
        if (!fb && !ig) return null
        return {
          organic: (fb?.reach_organic ?? 0) + (ig?.reach_organic ?? 0),
          total: (fb?.reach_total ?? 0) + (ig?.reach_total ?? 0),
          followers: (fb?.new_followers ?? 0) + (ig?.new_followers ?? 0),
          engagement: sumNullable(fb?.engagement, ig?.engagement),
        }
      }
      const dbPlat = plat === "fb" ? "facebook" : "instagram"
      const row = allMonthly.find(
        (r) => r.platform === dbPlat && r.year === year && r.month === month + 1
      )
      if (!row) return null
      return {
        organic: row.reach_organic ?? 0,
        total: row.reach_total ?? 0,
        followers: row.new_followers ?? 0,
        engagement: row.engagement,
      }
    },
    [allMonthly]
  )

  // Extract base value
  const baseValue = useMemo(() => {
    if (!basePeriod) return 0
    const [y, m] = basePeriod.split("-").map(Number)
    const data = getMonthData(platform, y, m)
    if (!data) return 0
    switch (metric) {
      case "organic_reach": return data.organic
      case "total_reach": return data.total
      case "followers": return data.followers
      case "engagement": return data.engagement ?? 0
      default: return 0
    }
  }, [basePeriod, platform, metric, getMonthData])

  // Generate 12-month projection
  const chartData = useMemo(() => {
    if (!basePeriod) return []
    const [baseYear, baseMonth] = basePeriod.split("-").map(Number)
    const rate = growthRate / 100
    const data: { label: string; actual: number | null; target: number }[] = []

    let curYear = baseYear
    let curMonth = baseMonth

    for (let i = 0; i < 12; i++) {
      curMonth++
      if (curMonth > 11) { curMonth = 0; curYear++ }

      const label = `${curYear}/${curMonth + 1}月`
      const md = getMonthData(platform, curYear, curMonth)

      let actual: number | null = null
      if (md) {
        switch (metric) {
          case "organic_reach": actual = md.organic; break
          case "total_reach": actual = md.total; break
          case "followers": actual = md.followers; break
          case "engagement": actual = md.engagement; break
        }
      }

      data.push({
        label,
        actual,
        target: Math.round(baseValue * Math.pow(1 + rate, i + 1)),
      })
    }
    return data
  }, [basePeriod, growthRate, platform, metric, baseValue, getMonthData])

  // Result summary
  const result = useMemo(() => {
    if (chartData.length === 0) return null
    const monthlyTarget = chartData[0].target
    const weeklyTarget = Math.round(monthlyTarget / 4)
    const quarterlyTarget = monthlyTarget * 3
    const month12Target = chartData[11]?.target ?? 0
    const annualTarget = chartData.reduce((s, d) => s + d.target, 0)
    return { weeklyTarget, monthlyTarget, quarterlyTarget, month12Target, annualTarget }
  }, [chartData])

  const metricLabel = metric.includes("reach") ? "觸及" : metric === "followers" ? "追蹤" : "互動"
  const platLabel = platform === "all" ? "FB + IG" : platform.toUpperCase()

  // Confirm sync goals to Supabase
  const syncGoals = async () => {
    if (!result) return
    setSyncing(true)
    const supabase = createClient()
    const isReach = metric === "organic_reach" || metric === "total_reach"
    const goalMetric = isReach ? "reach" : "followers"
    const year = new Date().getFullYear()

    const updatePlatform = async (dbPlatform: string) => {
      await supabase
        .from("goals")
        .update({
          weekly_target: result.weeklyTarget,
          monthly_target: result.monthlyTarget,
          quarterly_target: result.quarterlyTarget,
          annual_target: result.annualTarget,
          growth_rate: growthRate / 100,
          goal_source: "simulator",
          updated_at: new Date().toISOString(),
        })
        .eq("workspace_id", wsId)
        .eq("platform", dbPlatform)
        .eq("metric", goalMetric)
        .eq("year", year)
    }

    if (platform === "all" || platform === "fb") await updatePlatform("facebook")
    if (platform === "all" || platform === "ig") await updatePlatform("instagram")

    setSyncing(false)
    alert(
      `✅ 目標已更新！\n\n平台：${platLabel}｜指標：${metricLabel}\n週目標：${fmt(result.weeklyTarget)}\n月目標：${fmt(result.monthlyTarget)}\n季目標：${fmt(result.quarterlyTarget)}\n年度目標：${fmt(result.annualTarget)}\n\n週報追蹤 + 總覽 YTD 已同步更新。`
    )
  }

  const fmt = (v: number | null | undefined) =>
    v != null ? v.toLocaleString("zh-TW") : "--"

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-vertical:h-4" />
        <h1 className="text-lg font-semibold">目標模擬器</h1>
      </header>
      <div className="flex flex-1 flex-col gap-6 px-6 pb-6">
        {loading ? (
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">
            載入中...
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>目標模擬器</CardTitle>
              <p className="text-sm text-muted-foreground">
                選擇指標與基期，調整月成長率模擬未來 12 個月目標軌跡。確認後將同步更新週報追蹤的目標與達成率。
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">指標</span>
                  <NativeSelect value={metric} onChange={(e) => setMetric(e.target.value)} className="w-[120px]">
                    {METRICS.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </NativeSelect>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">平台</span>
                  <NativeSelect value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-[140px]">
                    <option value="all">全部（FB + IG）</option>
                    <option value="fb">Facebook</option>
                    <option value="ig">Instagram</option>
                  </NativeSelect>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    基期 <SourceBadge type="auto" />
                  </span>
                  <NativeSelect value={basePeriod} onChange={(e) => setBasePeriod(e.target.value)} className="w-[120px]">
                    {basePeriods.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              {/* Growth rate slider + presets */}
              <div className="rounded-lg bg-muted/30 p-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap">
                    月成長率 <SourceBadge type="manual" />
                  </span>
                  <Slider
                    value={[growthRate]}
                    onValueChange={(val) => {
                      const v = Array.isArray(val) ? val[0] : val
                      setGrowthRate(v)
                    }}
                    min={0.5}
                    max={30}
                    step={0.5}
                    className="flex-1"
                  />
                  <span className="min-w-[60px] text-right text-xl font-bold tabular-nums">
                    {growthRate.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.rate}
                      onClick={() => setGrowthRate(p.rate)}
                      className={`rounded px-3 py-1 text-sm transition-colors ${
                        growthRate === p.rate
                          ? "bg-foreground text-background"
                          : "bg-background border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {p.label} ({p.rate}%)
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart: bar (actuals) + line (target trajectory) */}
              {chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      tickFormatter={(v: number) =>
                        v >= 1000000
                          ? `${(v / 1000000).toFixed(1)}M`
                          : v >= 1000
                            ? `${(v / 1000).toFixed(0)}K`
                            : String(v)
                      }
                      tick={{ fontSize: 12 }}
                      stroke="var(--muted-foreground)"
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        value != null ? Number(value).toLocaleString("zh-TW") : "--",
                        name === "actual" ? "實際值" : "目標軌跡",
                      ]}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--card)",
                      }}
                    />
                    <Legend
                      formatter={(value: string) =>
                        value === "actual" ? "實際值" : "目標軌跡"
                      }
                    />
                    <Bar
                      dataKey="actual"
                      fill="rgba(108,92,231,0.6)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      type="monotone"
                      dataKey="target"
                      stroke="var(--brand-gold)"
                      strokeWidth={3}
                      strokeDasharray="6 3"
                      dot={{ r: 4, fill: "var(--brand-gold)" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              {/* Result summary */}
              {result && (
                <>
                  <p className="text-sm text-muted-foreground">
                    基期值 {fmt(baseValue)}（{platLabel}）× 月成長率{" "}
                    {growthRate.toFixed(1)}% → 確認後同步至週報追蹤
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg border-2 border-[var(--brand-gold)] bg-card p-4">
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        週目標{metricLabel}
                      </p>
                      <p className="mt-1 text-2xl font-bold text-[var(--brand-gold)] tabular-nums">
                        {fmt(result.weeklyTarget)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">= 月目標 ÷ 4</p>
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        月目標{metricLabel}
                      </p>
                      <p className="mt-1 text-2xl font-bold tabular-nums">
                        {fmt(result.monthlyTarget)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        = 基期 × (1+{growthRate.toFixed(1)}%)
                      </p>
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        季目標{metricLabel}
                      </p>
                      <p className="mt-1 text-2xl font-bold tabular-nums">
                        {fmt(result.quarterlyTarget)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">= 月目標 × 3</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    第 12 個月目標：{fmt(result.month12Target)} | 年度累計：
                    {fmt(result.annualTarget)}
                  </p>
                </>
              )}

              {/* Confirm button */}
              <button
                onClick={syncGoals}
                disabled={syncing || !result}
                className="w-full rounded-lg bg-[var(--brand-gold)] py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--brand-gold)]/90 disabled:opacity-50"
              >
                {syncing
                  ? "更新中..."
                  : "確認此目標設定 → 同步至週報追蹤"}
              </button>
            </CardContent>
          </Card>
        )}
      </div>
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

function sumNullable(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null && b == null) return null
  return (a ?? 0) + (b ?? 0)
}
