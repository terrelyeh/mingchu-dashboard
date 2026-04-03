"use client"

import { useMemo, useState } from "react"
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts"
import {
  QUARTERS,
  TARGETS,
  LAST_YEAR,
  PROJECTS,
  REVENUE_TYPE_COLOR,
  REVENUE_TYPE_LABEL,
  getCurrentQuarter,
  fmt,
  fmtWan,
  type QuarterSummary,
  type RevenueType,
  type Project,
} from "@/lib/revenue-data"

// ── 常數 ──────────────────────────────────────
const QUARTER_LABELS = ["Q1", "Q2", "Q3", "Q4"] as const
const MONTH_LABELS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]

// ── Helper ────────────────────────────────────
function pct(a: number, b: number) {
  if (b === 0) return 0
  return a / b
}

function progressColor(ratio: number): string {
  if (ratio >= 0.8) return "bg-[#16a34a]"
  if (ratio >= 0.5) return "bg-[#c99700]"
  return "bg-[#dc2626]"
}

function statusBadge(ratio: number) {
  if (ratio >= 1) return <Badge className="bg-[#16a34a]/10 text-[#16a34a] border-[#16a34a]/20">達標</Badge>
  if (ratio >= 0.8) return <Badge className="bg-[#c99700]/10 text-[#c99700] border-[#c99700]/20">接近</Badge>
  if (ratio >= 0.5) return <Badge className="bg-[#ea580c]/10 text-[#ea580c] border-[#ea580c]/20">警戒</Badge>
  return <Badge className="bg-[#dc2626]/10 text-[#dc2626] border-[#dc2626]/20">落後</Badge>
}

function typeBadge(type: RevenueType) {
  const colors: Record<RevenueType, string> = {
    confirmed: "bg-[#16a34a]/10 text-[#16a34a] border-[#16a34a]/20",
    expected: "bg-[#c99700]/10 text-[#c99700] border-[#c99700]/20",
    estimated: "bg-[#94a3b8]/10 text-[#64748b] border-[#94a3b8]/20",
    exchange: "bg-[#d4d4d8]/10 text-[#71717a] border-[#d4d4d8]/20",
  }
  return <Badge className={colors[type]}>{REVENUE_TYPE_LABEL[type]}</Badge>
}

// ── 主頁面 ─────────────────────────────────────
export default function RevenuePage() {
  const currentQ = getCurrentQuarter()
  const [activeTab, setActiveTab] = useState<"overview" | "projects">("overview")

  // ── 年度計算 ──
  const annual = useMemo(() => {
    const confirmed = QUARTERS.reduce((s, q) => s + q.confirmed.total, 0)
    const expected = QUARTERS.reduce((s, q) => s + q.expected.total, 0)
    const exchange = QUARTERS.reduce((s, q) => s + q.exchange.total, 0)
    const pipeline = confirmed + expected
    const targetL = TARGETS.L.annual
    const targetH = TARGETS.H.annual
    return {
      confirmed, expected, exchange, pipeline,
      targetL, targetH,
      pctL: pct(confirmed, targetL),
      pctH: pct(confirmed, targetH),
      pctL_pipeline: pct(pipeline, targetL),
      pctH_pipeline: pct(pipeline, targetH),
      gapL: targetL - pipeline,
      gapH: targetH - pipeline,
      lastYear: LAST_YEAR.annual,
      yoy: pct(confirmed - LAST_YEAR.annual, LAST_YEAR.annual),
    }
  }, [])

  // ── 時間進度 ──
  const timePct = useMemo(() => {
    const now = new Date()
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
    return dayOfYear / 365
  }, [])

  // ── 季度卡片資料 ──
  const quarterCards = useMemo(() => {
    const lastYearQ = [LAST_YEAR.q1, LAST_YEAR.q2, LAST_YEAR.q3, LAST_YEAR.q4]
    return QUARTERS.map((q, i) => {
      const pipeline = q.confirmed.total + q.expected.total
      const ratioL = pct(q.confirmed.total, q.targetL)
      const ratioL_pipe = pct(pipeline, q.targetL)
      const isPast = q.quarter < currentQ
      const isCurrent = q.quarter === currentQ
      return {
        ...q,
        pipeline,
        ratioL,
        ratioL_pipe,
        gapL: q.targetL - pipeline,
        lastYear: lastYearQ[i],
        yoy: lastYearQ[i] > 0 ? pct(q.confirmed.total - lastYearQ[i], lastYearQ[i]) : null,
        isPast,
        isCurrent,
      }
    })
  }, [currentQ])

  // ── 月度圖表資料 ──
  const monthlyChart = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const qi = Math.floor(i / 3)
      const mi = i % 3
      const q = QUARTERS[qi]
      return {
        month: MONTH_LABELS[i],
        confirmed: q.confirmed.monthly[mi],
        expected: q.expected.monthly[mi],
      }
    })
  }, [])

  // ── 專案列表（依確定性分組）──
  const projectGroups = useMemo(() => {
    const groups: Record<RevenueType, Project[]> = {
      confirmed: [],
      expected: [],
      estimated: [],
      exchange: [],
    }
    for (const p of PROJECTS) {
      groups[p.revenueType].push(p)
    }
    return groups
  }, [])

  // ── Pipeline 健康度分析 ──
  const health = useMemo(() => {
    const cq = quarterCards[currentQ - 1]
    const remainQ = quarterCards.filter(q => q.quarter >= currentQ)
    const remainTarget = remainQ.reduce((s, q) => s + q.targetL, 0)
    const remainPipeline = remainQ.reduce((s, q) => s + q.pipeline, 0)
    const coverageRatio = pct(remainPipeline, remainTarget)

    // 待收款
    const pendingCollection = PROJECTS.filter(
      p => p.revenueType === "confirmed" && p.collectionStatus === "pending"
    )
    const pendingAmount = pendingCollection.reduce((s, p) => s + p.amountWithTax, 0)

    return {
      currentQuarter: cq,
      remainTarget,
      remainPipeline,
      coverageRatio,
      pendingCollection,
      pendingAmount,
    }
  }, [quarterCards, currentQ])

  // ── 診斷訊息 ──
  const diagnosis = useMemo(() => {
    const messages: { level: "good" | "warn" | "bad"; text: string }[] = []

    // 年度整體
    if (annual.pctL_pipeline >= 0.8) {
      messages.push({ level: "good", text: `Pipeline 涵蓋目標 L 的 ${(annual.pctL_pipeline * 100).toFixed(0)}%，年度目標有機會達成` })
    } else if (annual.pctL_pipeline >= 0.5) {
      messages.push({ level: "warn", text: `Pipeline 僅涵蓋目標 L 的 ${(annual.pctL_pipeline * 100).toFixed(0)}%，需加速開發新案` })
    } else {
      messages.push({ level: "bad", text: `Pipeline 僅涵蓋目標 L 的 ${(annual.pctL_pipeline * 100).toFixed(0)}%，距離年度目標有顯著缺口` })
    }

    // 本季
    const cq = health.currentQuarter
    if (cq.ratioL_pipe >= 1) {
      messages.push({ level: "good", text: `本季 (${QUARTER_LABELS[currentQ - 1]}) pipeline 已超過目標，重點是確保成交轉換` })
    } else if (cq.ratioL_pipe >= 0.7) {
      messages.push({ level: "warn", text: `本季 (${QUARTER_LABELS[currentQ - 1]}) 還差 ${fmtWan(cq.gapL)} 才達標，需加緊` })
    } else {
      messages.push({ level: "bad", text: `本季 (${QUARTER_LABELS[currentQ - 1]}) 缺口 ${fmtWan(cq.gapL)}，需要積極補充案源` })
    }

    // 下半年預警
    const h2 = quarterCards.filter(q => q.quarter >= 3)
    const h2Target = h2.reduce((s, q) => s + q.targetL, 0)
    const h2Pipeline = h2.reduce((s, q) => s + q.pipeline, 0)
    const h2Ratio = pct(h2Pipeline, h2Target)
    if (h2Ratio < 0.3) {
      messages.push({ level: "bad", text: `下半年 pipeline 僅 ${fmtWan(h2Pipeline)}（目標 ${fmtWan(h2Target)} 的 ${(h2Ratio * 100).toFixed(0)}%），這是最大風險` })
    }

    // 收款
    if (health.pendingAmount > 500_000) {
      messages.push({ level: "warn", text: `待收款 ${fmtWan(health.pendingAmount)}，需跟進催款` })
    }

    return messages
  }, [annual, health, quarterCards, currentQ])

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-vertical:h-4" />
        <h1 className="text-lg font-semibold">營收追蹤</h1>
        <span className="ml-auto text-xs text-muted-foreground">
          資料更新：2026/04/03
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-6 pb-6">
        {/* ── 診斷 Alert ── */}
        <Card className="border-l-4 border-l-[#c99700]">
          <CardContent className="py-3 px-4">
            <div className="mb-1.5 text-xs font-semibold text-muted-foreground">業績健康診斷</div>
            <ul className="space-y-1">
              {diagnosis.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                    d.level === "good" ? "bg-[#16a34a]" : d.level === "warn" ? "bg-[#c99700]" : "bg-[#dc2626]"
                  }`} />
                  {d.text}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* ── KPI Cards（4 格）── */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* 年度確認營收 */}
          <Card className="border-l-4 border-l-[#16a34a]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                年度確認營收
              </CardTitle>
              {statusBadge(annual.pctL)}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{fmtWan(annual.confirmed)}</div>
              <div className="mt-2 h-2 w-full rounded-full bg-muted">
                <div className={`h-2 rounded-full transition-all ${progressColor(annual.pctL)}`}
                  style={{ width: `${Math.min(annual.pctL * 100, 100)}%` }} />
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>目標 L <strong className="text-foreground">{fmtWan(annual.targetL)}</strong></span>
                <span className="font-semibold">{(annual.pctL * 100).toFixed(1)}%</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                時間進度 {(timePct * 100).toFixed(0)}%
              </div>
            </CardContent>
          </Card>

          {/* Pipeline 總額 */}
          <Card className="border-l-4 border-l-[#c99700]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Pipeline（確認 + 預計）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{fmtWan(annual.pipeline)}</div>
              <div className="mt-2 h-2 w-full rounded-full bg-muted">
                <div className={`h-2 rounded-full transition-all ${progressColor(annual.pctL_pipeline)}`}
                  style={{ width: `${Math.min(annual.pctL_pipeline * 100, 100)}%` }} />
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>涵蓋目標 L</span>
                <span className="font-semibold">{(annual.pctL_pipeline * 100).toFixed(1)}%</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {annual.gapL > 0 ? `還差 ${fmtWan(annual.gapL)}` : "已超過目標 ✓"}
              </div>
            </CardContent>
          </Card>

          {/* 本季戰況 */}
          <Card className={`border-l-4 border-l-[#6C5CE7]`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                本季 {QUARTER_LABELS[currentQ - 1]} 戰況
              </CardTitle>
              {statusBadge(health.currentQuarter.ratioL)}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{fmtWan(health.currentQuarter.confirmed.total)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                含預計：<strong className="text-foreground">{fmtWan(health.currentQuarter.pipeline)}</strong>
                {" "}/ 目標 {fmtWan(health.currentQuarter.targetL)}
              </div>
              <div className="mt-1.5 h-2 w-full rounded-full bg-muted">
                {/* 確認 */}
                <div className="relative h-2 rounded-full">
                  <div className="absolute h-2 rounded-full bg-[#c99700]/30"
                    style={{ width: `${Math.min(health.currentQuarter.ratioL_pipe * 100, 100)}%` }} />
                  <div className="absolute h-2 rounded-full bg-[#16a34a]"
                    style={{ width: `${Math.min(health.currentQuarter.ratioL * 100, 100)}%` }} />
                </div>
              </div>
              <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#16a34a]" />確認 {(health.currentQuarter.ratioL * 100).toFixed(0)}%</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#c99700]/30" />含預計 {(health.currentQuarter.ratioL_pipe * 100).toFixed(0)}%</span>
              </div>
            </CardContent>
          </Card>

          {/* 待收款 */}
          <Card className="border-l-4 border-l-[#ea580c]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                待收款金額
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{fmtWan(health.pendingAmount)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {health.pendingCollection.length} 筆發票待收
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                已收款率{" "}
                <strong className="text-foreground">
                  {(pct(
                    PROJECTS.filter(p => p.revenueType === "confirmed" && p.collectionStatus === "collected")
                      .reduce((s, p) => s + p.amountWithTax, 0),
                    PROJECTS.filter(p => p.revenueType === "confirmed")
                      .reduce((s, p) => s + p.amountWithTax, 0)
                  ) * 100).toFixed(0)}%
                </strong>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── 頁籤切換 ── */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "overview"
                ? "border-b-2 border-[#c99700] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            季度總覽
          </button>
          <button
            onClick={() => setActiveTab("projects")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "projects"
                ? "border-b-2 border-[#c99700] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            專案 Pipeline
          </button>
        </div>

        {activeTab === "overview" ? (
          <>
            {/* ── 季度達成卡片 ── */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {quarterCards.map((q, i) => (
                <Card key={i} className={`transition-all ${
                  q.isCurrent ? "ring-2 ring-[#c99700]/40 shadow-md" : ""
                }`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">
                        {QUARTER_LABELS[i]}
                        {q.isCurrent && <span className="ml-1.5 text-xs font-normal text-[#c99700]">← 本季</span>}
                        {q.isPast && <span className="ml-1.5 text-xs font-normal text-muted-foreground">已結束</span>}
                      </CardTitle>
                      {statusBadge(q.ratioL)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* 確認營收 */}
                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">確認營收</span>
                        <span className="text-lg font-bold tabular-nums">{fmtWan(q.confirmed.total)}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                        <div className={`h-1.5 rounded-full ${progressColor(q.ratioL)}`}
                          style={{ width: `${Math.min(q.ratioL * 100, 100)}%` }} />
                      </div>
                      <div className="mt-0.5 text-right text-xs text-muted-foreground tabular-nums">
                        {(q.ratioL * 100).toFixed(0)}% / 目標 {fmtWan(q.targetL)}
                      </div>
                    </div>

                    {/* Pipeline */}
                    {q.expected.total > 0 && (
                      <div className="rounded bg-[#c99700]/5 px-2.5 py-1.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-[#c99700]">含預計</span>
                          <span className="text-sm font-semibold tabular-nums">{fmtWan(q.pipeline)}</span>
                        </div>
                        <div className="mt-0.5 text-right text-xs text-muted-foreground tabular-nums">
                          {(q.ratioL_pipe * 100).toFixed(0)}%
                          {q.gapL > 0 ? ` ｜差 ${fmtWan(q.gapL)}` : " ✓ 超標"}
                        </div>
                      </div>
                    )}

                    {/* YoY */}
                    {q.yoy !== null && (
                      <div className="text-xs text-muted-foreground">
                        去年同期 {fmtWan(q.lastYear)}
                        <span className={`ml-1 font-semibold ${q.yoy >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
                          {q.yoy >= 0 ? "+" : ""}{(q.yoy * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* ── 月度營收趨勢圖 ── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">月度營收趨勢</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={monthlyChart} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 12 }} />
                    <YAxis
                      tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}萬` : fmt(v)}
                      tick={{ fill: "#64748B", fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        `$${fmt(value as number)}`,
                        name === "confirmed" ? "確認營收" : "預計營收",
                      ]}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--card)",
                        fontSize: "13px",
                      }}
                    />
                    <Legend
                      formatter={(value) => value === "confirmed" ? "確認營收" : "預計營收"}
                    />
                    <Bar dataKey="confirmed" stackId="a" fill={REVENUE_TYPE_COLOR.confirmed} radius={[0, 0, 0, 0]}>
                      {monthlyChart.map((_, index) => {
                        const qi = Math.floor(index / 3)
                        const isCurQ = qi + 1 === currentQ
                        return <Cell key={index} fillOpacity={isCurQ ? 1 : 0.7} />
                      })}
                    </Bar>
                    <Bar dataKey="expected" stackId="a" fill={REVENUE_TYPE_COLOR.expected} radius={[4, 4, 0, 0]}>
                      {monthlyChart.map((_, index) => {
                        const qi = Math.floor(index / 3)
                        const isCurQ = qi + 1 === currentQ
                        return <Cell key={index} fillOpacity={isCurQ ? 1 : 0.5} />
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* ── 累計進度 ── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">累計業績 vs 目標</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">區間</TableHead>
                        <TableHead className="text-right">確認營收</TableHead>
                        <TableHead className="text-right">+ 預計</TableHead>
                        <TableHead className="text-right">= Pipeline</TableHead>
                        <TableHead className="text-right">目標 L</TableHead>
                        <TableHead className="text-right">達成率</TableHead>
                        <TableHead className="text-right">差距</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { label: "Q1", qs: [0] },
                        { label: "Q1+Q2", qs: [0, 1] },
                        { label: "Q1–Q3", qs: [0, 1, 2] },
                        { label: "全年", qs: [0, 1, 2, 3] },
                      ].map((row) => {
                        const confirmed = row.qs.reduce((s, qi) => s + QUARTERS[qi].confirmed.total, 0)
                        const expected = row.qs.reduce((s, qi) => s + QUARTERS[qi].expected.total, 0)
                        const pipeline = confirmed + expected
                        const target = row.qs.reduce((s, qi) => s + QUARTERS[qi].targetL, 0)
                        const ratio = pct(pipeline, target)
                        const gap = target - pipeline
                        const isFullYear = row.qs.length === 4
                        return (
                          <TableRow key={row.label} className={isFullYear ? "font-semibold" : ""}>
                            <TableCell>{row.label}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtWan(confirmed)}</TableCell>
                            <TableCell className="text-right tabular-nums text-[#c99700]">{fmtWan(expected)}</TableCell>
                            <TableCell className="text-right tabular-nums font-semibold">{fmtWan(pipeline)}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtWan(target)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              <span className={ratio >= 0.8 ? "text-[#16a34a]" : ratio >= 0.5 ? "text-[#c99700]" : "text-[#dc2626]"}>
                                {(ratio * 100).toFixed(1)}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {gap > 0 ? <span className="text-[#dc2626]">-{fmtWan(gap)}</span> : <span className="text-[#16a34a]">+{fmtWan(Math.abs(gap))}</span>}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* ── 專案 Pipeline Tab ── */}
            {(["confirmed", "expected", "estimated"] as RevenueType[]).map((type) => {
              const projects = projectGroups[type]
              if (projects.length === 0) return null
              const total = projects.reduce((s, p) => s + p.amountWithTax, 0)
              return (
                <Card key={type}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-semibold">{REVENUE_TYPE_LABEL[type]}</CardTitle>
                        {typeBadge(type)}
                      </div>
                      <span className="text-sm font-bold tabular-nums">{projects.length} 筆 ／ {fmtWan(total)}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>月份</TableHead>
                            <TableHead>專案名稱</TableHead>
                            <TableHead>分期</TableHead>
                            <TableHead className="text-right">含稅金額</TableHead>
                            <TableHead>狀態</TableHead>
                            <TableHead>收款</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projects.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="tabular-nums">{p.month}月</TableCell>
                              <TableCell className="max-w-[280px] truncate">{p.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{p.installment}</Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-medium">
                                ${fmt(p.amountWithTax)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {p.contractStatus === "signed" ? "已簽" : p.contractStatus === "quoted" ? "已報價" : "預估"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {p.collectionStatus === "collected" ? (
                                  <span className="text-xs text-[#16a34a] font-medium">已收</span>
                                ) : p.collectionStatus === "pending" ? (
                                  <span className="text-xs text-[#ea580c]">{p.note || "待收"}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </>
        )}
      </div>
    </>
  )
}
