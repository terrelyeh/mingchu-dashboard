"use client"

import { useState } from "react"
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

// ============================================================
// Meta Graph API endpoints used by the system
// ============================================================
type Endpoint = {
  id: string
  name: string
  platform: "facebook" | "instagram" | "both"
  apiPath: string
  description: string
  usedFor: string
  frequency: string
  version: string
  status: "ok" | "error" | "warning" | "untested"
  lastSuccess: string | null
  lastError: string | null
  lastErrorMsg: string | null
  avgResponseMs: number | null
  deprecated: boolean
  deprecationNote: string | null
}

const API_ENDPOINTS: Endpoint[] = [
  // ----- Facebook Page -----
  {
    id: "fb_page_info",
    name: "粉專基本資訊",
    platform: "facebook",
    apiPath: "/{page-id}?fields=name,fan_count,followers_count",
    description: "取得粉專名稱、粉絲數、追蹤數",
    usedFor: "粉絲數快照、總覽 KPI",
    frequency: "每日",
    version: "v21.0",
    status: "untested",
    lastSuccess: null,
    lastError: null,
    lastErrorMsg: null,
    avgResponseMs: null,
    deprecated: false,
    deprecationNote: null,
  },
  {
    id: "fb_page_insights_reach",
    name: "粉專觸及 Insights",
    platform: "facebook",
    apiPath: "/{page-id}/insights?metric=page_impressions_unique,page_post_engagements&period=week",
    description: "取得粉專週觸及（不重複）與互動數",
    usedFor: "週報數據",
    frequency: "每週",
    version: "v21.0",
    status: "untested",
    lastSuccess: null,
    lastError: null,
    lastErrorMsg: null,
    avgResponseMs: null,
    deprecated: false,
    deprecationNote: null,
  },
  {
    id: "fb_page_insights_monthly",
    name: "粉專月度 Insights",
    platform: "facebook",
    apiPath: "/{page-id}/insights?metric=page_views_total,page_post_engagements&period=month",
    description: "取得粉專月度不重複觸及（伺服器端去重）",
    usedFor: "月報數據（UU）",
    frequency: "每月",
    version: "v21.0",
    status: "untested",
    lastSuccess: null,
    lastError: null,
    lastErrorMsg: null,
    avgResponseMs: null,
    deprecated: false,
    deprecationNote: "page_fans 已於 2025/11/15 棄用，改用 follower_count",
  },
  {
    id: "fb_page_posts",
    name: "粉專貼文列表",
    platform: "facebook",
    apiPath: "/{page-id}/posts?fields=message,created_time,insights.metric(post_impressions_unique,post_engaged_users,post_clicks)",
    description: "取得貼文清單及各貼文的觸及、互動、連結點擊",
    usedFor: "貼文分析",
    frequency: "每日",
    version: "v21.0",
    status: "untested",
    lastSuccess: null,
    lastError: null,
    lastErrorMsg: null,
    avgResponseMs: null,
    deprecated: false,
    deprecationNote: null,
  },
  {
    id: "fb_post_insights",
    name: "個別貼文 Insights",
    platform: "facebook",
    apiPath: "/{post-id}/insights?metric=post_impressions_unique",
    description: "取得單篇貼文累積觸及，用於 W1/W2 追蹤",
    usedFor: "貼文 W1/W2 觸及",
    frequency: "發布後 +7/+14 天",
    version: "v21.0",
    status: "untested",
    lastSuccess: null,
    lastError: null,
    lastErrorMsg: null,
    avgResponseMs: null,
    deprecated: false,
    deprecationNote: null,
  },
  // ----- Instagram -----
  {
    id: "ig_account_info",
    name: "IG 帳號基本資訊",
    platform: "instagram",
    apiPath: "/{ig-user-id}?fields=followers_count,media_count",
    description: "取得 IG 追蹤者數、貼文數",
    usedFor: "粉絲數快照",
    frequency: "每日",
    version: "v21.0",
    status: "untested",
    lastSuccess: null,
    lastError: null,
    lastErrorMsg: null,
    avgResponseMs: null,
    deprecated: false,
    deprecationNote: null,
  },
  {
    id: "ig_insights_reach",
    name: "IG 觸及 Insights",
    platform: "instagram",
    apiPath: "/{ig-user-id}/insights?metric=reach,impressions,follower_count&period=day",
    description: "取得 IG 每日觸及與追蹤變化（無 period=month，需每日累計）",
    usedFor: "週報 / 月報數據（UU 為近似值）",
    frequency: "每日",
    version: "v21.0",
    status: "untested",
    lastSuccess: null,
    lastError: null,
    lastErrorMsg: null,
    avgResponseMs: null,
    deprecated: false,
    deprecationNote: "IG 無 period=month，UU 只能用每日累計近似值",
  },
  {
    id: "ig_media_list",
    name: "IG 貼文列表",
    platform: "instagram",
    apiPath: "/{ig-user-id}/media?fields=caption,timestamp,insights.metric(reach,engagement,impressions)",
    description: "取得 IG 貼文及觸及、互動指標",
    usedFor: "貼文分析",
    frequency: "每日",
    version: "v21.0",
    status: "untested",
    lastSuccess: null,
    lastError: null,
    lastErrorMsg: null,
    avgResponseMs: null,
    deprecated: false,
    deprecationNote: "IG 不提供 link_clicks，該欄位僅 FB 有",
  },
  {
    id: "ig_media_insights",
    name: "IG 個別貼文 Insights",
    platform: "instagram",
    apiPath: "/{media-id}/insights?metric=reach,engagement",
    description: "取得單篇 IG 貼文累積觸及，用於 W1/W2",
    usedFor: "貼文 W1/W2 觸及",
    frequency: "發布後 +7/+14 天",
    version: "v21.0",
    status: "untested",
    lastSuccess: null,
    lastError: null,
    lastErrorMsg: null,
    avgResponseMs: null,
    deprecated: false,
    deprecationNote: null,
  },
  // ----- OAuth -----
  {
    id: "oauth_token_refresh",
    name: "Token 續期",
    platform: "both",
    apiPath: "/oauth/access_token?grant_type=fb_exchange_token",
    description: "將短期 Token 換為長期 Token（60 天），並定期自動續期",
    usedFor: "OAuth 驗證",
    frequency: "每 50 天",
    version: "v21.0",
    status: "untested",
    lastSuccess: null,
    lastError: null,
    lastErrorMsg: null,
    avgResponseMs: null,
    deprecated: false,
    deprecationNote: null,
  },
]

// ============================================================
// Demo sync log (will be replaced by real data from Supabase)
// ============================================================
type SyncLog = {
  id: string
  timestamp: string
  endpointId: string
  endpointName: string
  status: "success" | "error" | "warning"
  responseMs: number
  message: string
}

const DEMO_SYNC_LOGS: SyncLog[] = [
  {
    id: "1",
    timestamp: "2026-04-03 02:00:12",
    endpointId: "fb_page_info",
    endpointName: "粉專基本資訊",
    status: "success",
    responseMs: 234,
    message: "成功取得粉絲數 12,847",
  },
  {
    id: "2",
    timestamp: "2026-04-03 02:00:15",
    endpointId: "ig_account_info",
    endpointName: "IG 帳號基本資訊",
    status: "success",
    responseMs: 189,
    message: "成功取得追蹤者 8,921",
  },
  {
    id: "3",
    timestamp: "2026-04-03 02:00:18",
    endpointId: "fb_page_posts",
    endpointName: "粉專貼文列表",
    status: "warning",
    responseMs: 1520,
    message: "回應時間偏長（>1s），可能接近速率限制",
  },
  {
    id: "4",
    timestamp: "2026-04-02 02:00:05",
    endpointId: "ig_insights_reach",
    endpointName: "IG 觸及 Insights",
    status: "error",
    responseMs: 0,
    message: "Error 190: OAuth Token expired — 已自動觸發 Token 續期",
  },
  {
    id: "5",
    timestamp: "2026-04-02 02:00:08",
    endpointId: "oauth_token_refresh",
    endpointName: "Token 續期",
    status: "success",
    responseMs: 412,
    message: "Token 續期成功，新到期日 2026-06-01",
  },
  {
    id: "6",
    timestamp: "2026-04-01 08:00:03",
    endpointId: "fb_page_insights_monthly",
    endpointName: "粉專月度 Insights",
    status: "success",
    responseMs: 678,
    message: "成功取得 2026/3 月度數據",
  },
]

export default function ApiHealthPage() {
  const [testing, setTesting] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<"all" | "facebook" | "instagram">("all")

  const filtered = filter === "all"
    ? API_ENDPOINTS
    : API_ENDPOINTS.filter((e) => e.platform === filter || e.platform === "both")

  // Count by status
  const statusCounts = {
    ok: API_ENDPOINTS.filter((e) => e.status === "ok").length,
    warning: API_ENDPOINTS.filter((e) => e.status === "warning").length,
    error: API_ENDPOINTS.filter((e) => e.status === "error").length,
    untested: API_ENDPOINTS.filter((e) => e.status === "untested").length,
  }

  const handleTestAll = () => {
    // Demo: simulate testing all endpoints
    setTesting(new Set(API_ENDPOINTS.map((e) => e.id)))
    setTimeout(() => setTesting(new Set()), 2000)
  }

  const handleTestOne = (id: string) => {
    setTesting((prev) => new Set(prev).add(id))
    setTimeout(() => {
      setTesting((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 1500)
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-vertical:h-4" />
        <h1 className="text-lg font-semibold">API 診斷</h1>
      </header>
      <div className="flex flex-1 flex-col gap-6 px-6 pb-6">
        {/* ===== Status Overview ===== */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatusCard label="正常" count={statusCounts.ok} color="bg-green-500" />
          <StatusCard label="警告" count={statusCounts.warning} color="bg-amber-500" />
          <StatusCard label="錯誤" count={statusCounts.error} color="bg-red-500" />
          <StatusCard label="未測試" count={statusCounts.untested} color="bg-gray-400" />
        </div>

        {/* ===== Endpoint List ===== */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>API 端點總覽</CardTitle>
                <CardDescription>
                  系統使用的所有 Meta Graph API / Instagram API 端點
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {(["all", "facebook", "instagram"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setFilter(p)}
                      className={`rounded px-2.5 py-1 text-xs transition-colors ${
                        filter === p
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {p === "all" ? "全部" : p === "facebook" ? "FB" : "IG"}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleTestAll}
                  disabled={testing.size > 0}
                  className="rounded-lg bg-[var(--brand-gold)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-gold)]/90 disabled:opacity-40"
                >
                  {testing.size > 0 ? "測試中..." : "全部測試"}
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filtered.map((ep) => (
                <div
                  key={ep.id}
                  className={`rounded-lg border p-4 ${ep.deprecated ? "opacity-60" : ""}`}
                >
                  {/* Row 1: name, platform, status, action */}
                  <div className="flex flex-wrap items-center gap-2">
                    <PlatformBadge platform={ep.platform} />
                    <span className="font-medium">{ep.name}</span>
                    <StatusBadge status={ep.status} testing={testing.has(ep.id)} />
                    <Badge variant="secondary" className="text-[10px]">
                      {ep.version}
                    </Badge>
                    <button
                      onClick={() => handleTestOne(ep.id)}
                      disabled={testing.has(ep.id)}
                      className="ml-auto rounded border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                    >
                      {testing.has(ep.id) ? "測試中..." : "測試連線"}
                    </button>
                  </div>
                  {/* Row 2: description + meta */}
                  <p className="mt-1.5 text-sm text-muted-foreground">{ep.description}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>用途：{ep.usedFor}</span>
                    <span>頻率：{ep.frequency}</span>
                  </div>
                  {/* Row 3: API path */}
                  <code className="mt-2 block overflow-hidden rounded bg-muted px-2.5 py-1.5 text-[11px] font-mono text-muted-foreground break-all whitespace-pre-wrap">
                    {ep.apiPath}
                  </code>
                  {ep.deprecationNote && (
                    <p className="mt-2 rounded bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
                      {ep.deprecationNote}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ===== Recent Sync Log ===== */}
        <Card>
          <CardHeader>
            <CardTitle>最近同步紀錄</CardTitle>
            <CardDescription>
              最近的 API 呼叫紀錄與結果（以下為示範資料）
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">時間</TableHead>
                    <TableHead className="min-w-[140px]">端點</TableHead>
                    <TableHead className="min-w-[60px]">狀態</TableHead>
                    <TableHead className="min-w-[80px] text-right">回應時間</TableHead>
                    <TableHead className="min-w-[250px]">訊息</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DEMO_SYNC_LOGS.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="tabular-nums text-sm">
                        {log.timestamp}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {log.endpointName}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={log.status === "success" ? "ok" : log.status}
                          testing={false}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {log.responseMs > 0 ? (
                          <span className={log.responseMs > 1000 ? "text-amber-600 font-semibold" : ""}>
                            {log.responseMs}ms
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ===== Common Issues ===== */}
        <Card>
          <CardHeader>
            <CardTitle>常見問題排查</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <TroubleshootItem
              code="190"
              title="OAuth Token 過期"
              solution="系統會自動續期 Token。若持續出現此錯誤，請至設定頁重新連接社群帳號。"
            />
            <TroubleshootItem
              code="4"
              title="API 速率限制 (Rate Limit)"
              solution="Meta API 限制約 200 次/小時。系統已合併請求，通常不會觸發。若出現此錯誤，等待 1 小時後會自動恢復。"
            />
            <TroubleshootItem
              code="100"
              title="無效的參數 / Metric 名稱變更"
              solution="Meta 可能已更新 API metric 名稱。請檢查上方端點的 API Path 是否仍然有效，並參考 Meta 官方文件確認最新名稱。"
            />
            <TroubleshootItem
              code="803"
              title="粉專 / 帳號已被移除或停用"
              solution="確認 Facebook 粉專或 Instagram 帳號仍然存在且為商業帳號。"
            />
            <TroubleshootItem
              code="10"
              title="權限不足"
              solution="確認連接帳號的使用者擁有粉專管理員權限，且 App 已取得 pages_show_list、pages_read_engagement、instagram_basic 等權限。"
            />
            <TroubleshootItem
              code="--"
              title="IG 資料回傳 0 或空值"
              solution="Instagram 商業帳號需綁定 Facebook 粉專。確認帳號類型為「商業帳號」而非「創作者帳號」，且已正確綁定。"
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

// ===== Sub-components =====

function StatusCard({
  label,
  count,
  color,
}: {
  label: string
  count: number
  color: string
}) {
  return (
    <div className="rounded-lg border bg-card p-4 text-center">
      <div className={`mx-auto mb-2 h-2 w-2 rounded-full ${color}`} />
      <p className="text-2xl font-bold tabular-nums">{count}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function StatusBadge({
  status,
  testing,
}: {
  status: "ok" | "error" | "warning" | "untested" | string
  testing: boolean
}) {
  if (testing) {
    return (
      <Badge variant="secondary" className="bg-blue-100 text-blue-700 animate-pulse">
        測試中
      </Badge>
    )
  }
  switch (status) {
    case "ok":
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-700">
          正常
        </Badge>
      )
    case "warning":
      return (
        <Badge variant="secondary" className="bg-amber-100 text-amber-700">
          警告
        </Badge>
      )
    case "error":
      return (
        <Badge variant="secondary" className="bg-red-100 text-red-700">
          錯誤
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-500">
          未測試
        </Badge>
      )
  }
}

function PlatformBadge({ platform }: { platform: "facebook" | "instagram" | "both" }) {
  if (platform === "both") {
    return (
      <div className="flex gap-0.5">
        <Badge variant="secondary" className="text-[10px] px-1 text-[var(--fb-blue)]">
          FB
        </Badge>
        <Badge variant="secondary" className="text-[10px] px-1 text-[var(--ig-pink)]">
          IG
        </Badge>
      </div>
    )
  }
  return (
    <Badge
      variant="secondary"
      className={`text-[10px] ${
        platform === "facebook" ? "text-[var(--fb-blue)]" : "text-[var(--ig-pink)]"
      }`}
    >
      {platform === "facebook" ? "FB" : "IG"}
    </Badge>
  )
}

function TroubleshootItem({
  code,
  title,
  solution,
}: {
  code: string
  title: string
  solution: string
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-1">
        <code className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-mono font-semibold text-red-700">
          Error {code}
        </code>
        <span className="font-medium text-sm">{title}</span>
      </div>
      <p className="text-sm text-muted-foreground">{solution}</p>
    </div>
  )
}
