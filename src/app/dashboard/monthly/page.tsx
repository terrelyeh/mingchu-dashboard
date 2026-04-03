"use client"

import React, { useEffect, useState, useMemo, useCallback } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent } from "@/components/ui/card"
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

type MonthlyRow = {
  platform: string
  year: number
  month: number
  reach_organic: number | null
  reach_ad: number | null
  reach_total: number | null
  uu: number | null
  new_followers: number | null
  engagement: number | null
  link_clicks: number | null
  source: string
}

const DEMO_WS = "00000000-0000-0000-0000-000000000001"
const MONTHS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
]

export default function MonthlyPage() {
  const { activeWorkspace } = useWorkspace()
  const wsId = activeWorkspace?.id ?? DEMO_WS

  const [allRows, setAllRows] = useState<MonthlyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState<string>("2026")
  const [platformFilter, setPlatformFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"monthly" | "quarterly">("monthly")
  const [showYoY, setShowYoY] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    setLoading(true)
    supabase
      .from("monthly_summary")
      .select(
        "platform, year, month, reach_organic, reach_ad, reach_total, uu, new_followers, engagement, link_clicks, source"
      )
      .eq("workspace_id", wsId)
      .then(({ data }) => {
        setAllRows(data ?? [])
        setLoading(false)
      })
  }, [wsId])

  // Available years
  const years = useMemo(
    () => [...new Set(allRows.map((r) => r.year))].sort((a, b) => b - a),
    [allRows]
  )

  // Get month data for a specific platform/year/month combination
  // When platform='all', sum FB+IG
  const getMonthData = useCallback(
    (platform: string, year: number, month: number) => {
      if (platform === "all") {
        const fb = allRows.find(
          (r) => r.platform === "facebook" && r.year === year && r.month === month + 1
        )
        const ig = allRows.find(
          (r) => r.platform === "instagram" && r.year === year && r.month === month + 1
        )
        if (!fb && !ig) return null
        return {
          organic: (fb?.reach_organic ?? 0) + (ig?.reach_organic ?? 0),
          ad: (fb?.reach_ad ?? 0) + (ig?.reach_ad ?? 0),
          total: (fb?.reach_total ?? 0) + (ig?.reach_total ?? 0),
          uu: null as number | null, // UU can't be summed across platforms
          followers: (fb?.new_followers ?? 0) + (ig?.new_followers ?? 0),
          engagement: sumNullable(fb?.engagement, ig?.engagement),
          clicks: sumNullable(fb?.link_clicks, ig?.link_clicks),
        }
      }
      const dbPlatform = platform === "fb" ? "facebook" : "instagram"
      const row = allRows.find(
        (r) => r.platform === dbPlatform && r.year === year && r.month === month + 1
      )
      if (!row) return null
      return {
        organic: row.reach_organic ?? 0,
        ad: row.reach_ad ?? 0,
        total: row.reach_total ?? 0,
        uu: row.uu,
        followers: row.new_followers ?? 0,
        engagement: row.engagement,
        clicks: row.link_clicks,
      }
    },
    [allRows]
  )

  // Build 12-month array for the selected year
  const yearData = useMemo(() => {
    const year = Number(yearFilter)
    return Array.from({ length: 12 }, (_, m) => getMonthData(platformFilter, year, m))
  }, [yearFilter, platformFilter, getMonthData])

  // Check consecutive drops for trend warning (⚠️ if 3 consecutive months of total reach declining)
  const reachWarnings = useMemo(() => {
    const drops: boolean[] = []
    for (let m = 1; m < 12; m++) {
      if (
        yearData[m] &&
        yearData[m - 1] &&
        yearData[m]!.total !== null &&
        yearData[m - 1]!.total !== null
      ) {
        drops.push(yearData[m]!.total < yearData[m - 1]!.total)
      } else {
        drops.push(false)
      }
    }
    const warnings = new Set<number>()
    for (let i = 2; i < drops.length; i++) {
      if (drops[i] && drops[i - 1] && drops[i - 2]) {
        warnings.add(i + 1) // month index (0-based, the third drop month)
      }
    }
    return warnings
  }, [yearData])

  // Conditional column visibility
  const showClicks = platformFilter !== "ig" && platformFilter !== "instagram"
  const showUU = platformFilter !== "all"
  const year = Number(yearFilter)

  const fmt = (v: number | null | undefined) =>
    v != null ? v.toLocaleString("zh-TW") : "--"

  const fmtPct = (v: number | null | undefined) => {
    if (v == null) return <span className="text-muted-foreground">--</span>
    const color = v > 0 ? "text-green-600" : v < 0 ? "text-red-500" : ""
    return (
      <span className={color}>
        {v > 0 ? "+" : ""}
        {v.toFixed(1)}%
      </span>
    )
  }

  // Quarterly subtotals
  const getQuarterData = (qIdx: number) => {
    let qOrg = 0, qAd = 0, qTotal = 0, qFollow = 0, qEng = 0, qClicks = 0, qHas = false
    for (let m = qIdx * 3; m < qIdx * 3 + 3; m++) {
      const d = yearData[m]
      if (d) {
        qHas = true
        qOrg += d.organic
        qAd += d.ad
        qTotal += d.total
        qFollow += d.followers
        qEng += d.engagement ?? 0
        qClicks += d.clicks ?? 0
      }
    }
    if (!qHas) return null
    return {
      organic: qOrg,
      ad: qAd,
      total: qTotal,
      followers: qFollow,
      engagement: qEng || null,
      clicks: qClicks || null,
    }
  }

  // QoQ growth
  const getQoQ = (qIdx: number) => {
    if (qIdx === 0) return null
    const curr = getQuarterData(qIdx)
    const prev = getQuarterData(qIdx - 1)
    if (!curr || !prev || prev.total === 0) return null
    return ((curr.total - prev.total) / prev.total) * 100
  }

  // Annual totals
  const annualTotals = useMemo(() => {
    let org = 0, ad = 0, total = 0, follow = 0, eng = 0, clicks = 0, hasData = false
    for (const d of yearData) {
      if (d) {
        hasData = true
        org += d.organic
        ad += d.ad
        total += d.total
        follow += d.followers
        eng += d.engagement ?? 0
        clicks += d.clicks ?? 0
      }
    }
    return hasData
      ? { organic: org, ad, total, followers: follow, engagement: eng || null, clicks: clicks || null }
      : null
  }, [yearData])

  // YoY data helper
  const getYoYData = (monthIdx: number) => {
    const prevYear = year - 1
    const prevD = getMonthData(platformFilter, prevYear, monthIdx)
    const currD = yearData[monthIdx]
    if (!prevD || !currD) return { prevTotal: prevD?.total ?? null, yoyPct: null }
    const yoyPct = prevD.total > 0 ? ((currD.total - prevD.total) / prevD.total) * 100 : null
    return { prevTotal: prevD.total, yoyPct }
  }

  // Column count for colSpan
  const baseCols = 7 + (showClicks ? 1 : 0) + (showUU ? 1 : 0) + (showYoY ? 2 : 0)

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-vertical:h-4" />
        <h1 className="text-lg font-semibold">月度明細</h1>
      </header>
      <div className="flex flex-1 flex-col gap-6 px-6 pb-6">
        <Card>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">年份</span>
              <NativeSelect value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="w-[100px]">
                {years.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </NativeSelect>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">平台</span>
              <NativeSelect value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="w-[100px]">
                <option value="all">全部</option>
                <option value="fb">FB</option>
                <option value="ig">IG</option>
              </NativeSelect>
            </div>

            <Separator orientation="vertical" className="data-vertical:h-6" />

            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground mr-1">檢視</span>
              <button
                onClick={() => setViewMode("monthly")}
                className={`rounded px-3 py-1 text-sm transition-colors ${
                  viewMode === "monthly"
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                月度
              </button>
              <button
                onClick={() => setViewMode("quarterly")}
                className={`rounded px-3 py-1 text-sm transition-colors ${
                  viewMode === "quarterly"
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                季度
              </button>
            </div>

            <button
              onClick={() => setShowYoY(!showYoY)}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                showYoY
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              YoY 比較
            </button>
          </div>

          {/* Table */}
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                載入中...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">月份</TableHead>
                      <TableHead className="text-right">
                        自然觸及
                        <SourceBadge type="auto" />
                      </TableHead>
                      <TableHead className="text-right">
                        廣告觸及
                        <SourceBadge type="auto" />
                      </TableHead>
                      <TableHead className="text-right">
                        總觸及
                        <SourceBadge type="calc" />
                      </TableHead>
                      {showUU && (
                        <TableHead className="text-right">
                          月 UU
                          <SourceBadge
                            type="auto"
                            label={platformFilter === "ig" ? "近似" : undefined}
                            igStyle={platformFilter === "ig"}
                          />
                        </TableHead>
                      )}
                      <TableHead className="text-right">
                        新增淨追蹤
                        <SourceBadge type="auto" />
                      </TableHead>
                      <TableHead className="text-right">
                        互動數
                        <SourceBadge type="auto" />
                      </TableHead>
                      {showClicks && (
                        <TableHead className="text-right">
                          連結點擊
                          <SourceBadge type="auto" />
                        </TableHead>
                      )}
                      <TableHead className="text-right">
                        月成長率
                        <SourceBadge type="calc" />
                      </TableHead>
                      {showYoY && (
                        <>
                          <TableHead className="text-right text-muted-foreground">
                            去年同期觸及
                          </TableHead>
                          <TableHead className="text-right text-muted-foreground">
                            YoY%
                          </TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 12 }, (_, m) => {
                      const d = yearData[m]
                      const qIdx = Math.floor(m / 3)
                      const isQuarterEnd = (m + 1) % 3 === 0

                      // Monthly row (skip in quarterly view)
                      const monthRow =
                        viewMode !== "quarterly" ? (
                          <TableRow key={`month-${m}`}>
                            {d ? (
                              <>
                                <TableCell className="font-medium">
                                  {MONTHS[m]}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {fmt(d.organic)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {fmt(d.ad)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-semibold">
                                  {fmt(d.total)}
                                  {reachWarnings.has(m) && (
                                    <span
                                      className="ml-1 text-amber-500"
                                      title="連續3個月下降"
                                    >
                                      ⚠️
                                    </span>
                                  )}
                                </TableCell>
                                {showUU && (
                                  <TableCell className="text-right tabular-nums">
                                    {d.uu != null ? (
                                      fmt(d.uu)
                                    ) : (
                                      <span className="text-muted-foreground">
                                        待接入
                                      </span>
                                    )}
                                  </TableCell>
                                )}
                                <TableCell className="text-right tabular-nums">
                                  {fmt(d.followers)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {fmt(d.engagement)}
                                </TableCell>
                                {showClicks && (
                                  <TableCell className="text-right tabular-nums">
                                    {fmt(d.clicks)}
                                  </TableCell>
                                )}
                                <TableCell className="text-right tabular-nums">
                                  {(() => {
                                    if (m === 0) return fmtPct(null)
                                    const prev = yearData[m - 1]
                                    if (!prev || !prev.total) return fmtPct(null)
                                    const mom =
                                      ((d.total - prev.total) / prev.total) * 100
                                    return fmtPct(mom)
                                  })()}
                                </TableCell>
                                {showYoY && (() => {
                                  const { prevTotal, yoyPct } = getYoYData(m)
                                  return (
                                    <>
                                      <TableCell className="text-right tabular-nums text-muted-foreground">
                                        {fmt(prevTotal)}
                                      </TableCell>
                                      <TableCell className="text-right tabular-nums">
                                        {fmtPct(yoyPct)}
                                      </TableCell>
                                    </>
                                  )
                                })()}
                              </>
                            ) : (
                              <>
                                <TableCell className="font-medium">
                                  {MONTHS[m]}
                                </TableCell>
                                <TableCell
                                  colSpan={baseCols - 1}
                                  className="text-center text-muted-foreground"
                                >
                                  尚無資料
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        ) : null

                      // Quarterly subtotal row
                      const quarterRow = isQuarterEnd
                        ? (() => {
                            const qd = getQuarterData(qIdx)
                            if (!qd) return null
                            const qoq = getQoQ(qIdx)

                            // Quarter YoY
                            let qYoY: { prevTotal: number | null; yoyPct: number | null } = {
                              prevTotal: null,
                              yoyPct: null,
                            }
                            if (showYoY) {
                              const prevYear = year - 1
                              let prevQTotal = 0
                              let prevQHas = false
                              for (let qi = qIdx * 3; qi < qIdx * 3 + 3; qi++) {
                                const pd = getMonthData(platformFilter, prevYear, qi)
                                if (pd) {
                                  prevQTotal += pd.total
                                  prevQHas = true
                                }
                              }
                              qYoY = {
                                prevTotal: prevQHas ? prevQTotal : null,
                                yoyPct:
                                  prevQHas && prevQTotal > 0
                                    ? ((qd.total - prevQTotal) / prevQTotal) * 100
                                    : null,
                              }
                            }

                            return (
                              <TableRow
                                key={`q-${qIdx}`}
                                className="bg-muted/50 font-semibold"
                              >
                                <TableCell>Q{qIdx + 1} 小計</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {fmt(qd.organic)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {fmt(qd.ad)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {fmt(qd.total)}
                                </TableCell>
                                {showUU && (
                                  <TableCell className="text-right text-muted-foreground">
                                    --
                                  </TableCell>
                                )}
                                <TableCell className="text-right tabular-nums">
                                  {fmt(qd.followers)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {fmt(qd.engagement)}
                                </TableCell>
                                {showClicks && (
                                  <TableCell className="text-right tabular-nums">
                                    {fmt(qd.clicks)}
                                  </TableCell>
                                )}
                                <TableCell className="text-right tabular-nums">
                                  {fmtPct(qoq)}
                                </TableCell>
                                {showYoY && (
                                  <>
                                    <TableCell className="text-right tabular-nums text-muted-foreground">
                                      {fmt(qYoY.prevTotal)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                      {fmtPct(qYoY.yoyPct)}
                                    </TableCell>
                                  </>
                                )}
                              </TableRow>
                            )
                          })()
                        : null

                      return (
                        <React.Fragment key={`row-${m}`}>{monthRow}{quarterRow}</React.Fragment>
                      )
                    })}

                    {/* Annual total row */}
                    {annualTotals && (
                      <TableRow className="border-t-2 bg-muted font-bold">
                        <TableCell>年度合計</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmt(annualTotals.organic)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmt(annualTotals.ad)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmt(annualTotals.total)}
                        </TableCell>
                        {showUU && (
                          <TableCell className="text-right text-muted-foreground">
                            --
                          </TableCell>
                        )}
                        <TableCell className="text-right tabular-nums">
                          {fmt(annualTotals.followers)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmt(annualTotals.engagement)}
                        </TableCell>
                        {showClicks && (
                          <TableCell className="text-right tabular-nums">
                            {fmt(annualTotals.clicks)}
                          </TableCell>
                        )}
                        <TableCell />
                        {showYoY && (() => {
                          const prevYear = year - 1
                          let prevAnnTotal = 0
                          let prevHas = false
                          for (let m = 0; m < 12; m++) {
                            const pd = getMonthData(platformFilter, prevYear, m)
                            if (pd) {
                              prevAnnTotal += pd.total
                              prevHas = true
                            }
                          }
                          const yoyPct =
                            prevHas && prevAnnTotal > 0
                              ? ((annualTotals.total - prevAnnTotal) / prevAnnTotal) * 100
                              : null
                          return (
                            <>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {prevHas ? fmt(prevAnnTotal) : fmt(null)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {fmtPct(yoyPct)}
                              </TableCell>
                            </>
                          )
                        })()}
                      </TableRow>
                    )}
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

function SourceBadge({
  type,
  label,
  igStyle,
}: {
  type: "auto" | "calc" | "manual"
  label?: string
  igStyle?: boolean
}) {
  const displayLabel = label ?? (type === "auto" ? "自動" : type === "calc" ? "計算" : "手動")
  const bgColor =
    igStyle
      ? "bg-pink-100 text-[var(--ig-pink)]"
      : type === "auto"
        ? "bg-green-100 text-green-700"
        : type === "calc"
          ? "bg-blue-100 text-blue-700"
          : "bg-amber-100 text-amber-700"

  return (
    <span
      className={`ml-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight align-middle ${bgColor}`}
    >
      {displayLabel}
    </span>
  )
}

function sumNullable(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null && b == null) return null
  return (a ?? 0) + (b ?? 0)
}
