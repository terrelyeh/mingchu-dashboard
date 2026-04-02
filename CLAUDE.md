# CLAUDE.md — Project Context

> Last updated: 2026-04-02

## Project Overview

MINGCHU 社群媒體儀表板專案，整合 Facebook 粉專與 Instagram 帳號的數據，建立互動式分析儀表板。最終目標是 Meta API 自動擷取 → 資料分析 → 目標追蹤 → 儀表板呈現的全自動管線。

功能清單與產品定位詳見 [README.md](README.md)。
完整規格詳見 `Social/MINCHU_Social_Dashboard_專案開發文件.md`。

## Tech Stack

### Phase 1（目前，v2 Demo）
- **前端**：純 HTML + Chart.js v4.5.1（自包含單一檔案）
- **字體**：Noto Sans TC（Google Fonts）
- **品牌色**：`#c99700`（金）、`#e0e1dd`（淺灰背景）、`#333333`（深色文字/header）
- **部署**：Vercel（GitHub auto-deploy），landing page 提供 v2 / v1 / 文件入口

### Phase 2+（正式開發，已確認）
- **前端框架**：Next.js 14+（App Router）
- **UI 元件庫**：shadcn/ui（基於 Radix UI）
- **CSS**：Tailwind CSS
- **圖表**：Recharts（shadcn/ui 官方整合）
- **後端 / 資料庫**：Supabase（PostgreSQL + Edge Functions + Auth）
- **排程**：Supabase Edge Functions + pg_cron
- **部署**：Vercel
- **資料來源**：Meta Graph API v21.0、Instagram Graph API、Marketing API (Ads)

## Directory Structure

```
MINCHU Dashboard/
├── CLAUDE.md                          ← 本檔案
├── index.html                         ← Landing page（v2 / v1 / docs 入口）
├── vercel.json                        ← Vercel rewrites 設定
├── MINGCHU_Logo.png                   ← 品牌 Logo（深色文字版）
└── Social/
    ├── MINCHU_Social_Dashboard.html           ← v2 主儀表板（5 頁籤）
    ├── MINCHU_Social_Dashboard_v1_archive.html ← v1 舊版（9 頁籤，供參考）
    ├── MINCHU_Social_Dashboard_專案開發文件.md   ← 專案文件 v2.0
    ├── MINCHU_Social_Dashboard_專案開發文件.html ← 專案文件（網頁版）
    ├── MINGCHU Chefs and more.png             ← 品牌 Logo（白色文字版）
    └── Raw Social Report/                     ← 8 張原始 Google Sheets CSV
```

## Architecture & Data Flow

### 前端資料常數（Phase 1）
- `YEARLY_FANS` — 2019-2025 歷年粉絲數（FB/IG/合計）
- `MONTHLY_DATA` — 2024-2026 月度數據（organic/ad/total/followers/engagement/clicks）
- `WEEKLY_DATA` — 週報追蹤（fb_reach/fb_followers/ig_reach/ig_followers/ig_engagement/line）
- `GOALS` — 目標設定（weekly/monthly/q1/annual_2026），可 inline 編輯或模擬器同步
- `POST_DATA` — 貼文分析（含 reach_w1/reach_w2/organic_reach 三欄觸及衰退追蹤）
- `POST_CATEGORIES` — 貼文分類（人工標記）

### 目標連動機制
- **模擬器確認** → 更新 GOALS 的 weekly/monthly/q1/annual → 重新渲染週報追蹤 + 總覽 YTD
- **Inline 編輯週目標** → 同步 monthly(×4) / q1(×13) / annual(×48) → 重新渲染
- `goalSource` 物件追蹤來源（「預設值」/「模擬器設定」/「手動編輯」+ 時間戳）

### 資料來源標籤系統
所有欄位標註：`自動`（API）/ `手動`（人工輸入）/ `計算`（推導值）/ `近似`（IG UU）

## Conventions

- 所有 UI 文字使用**繁體中文**
- 缺失值前端顯示 `--` 加註「待接入」，不使用 0 替代
- 負責人：Clara Chang（FB）、Mike Chen（IG）
- 篩選器使用 `.filter-group` 分組式 UI（灰底圓角 + 分隔線）
- 進度條顏色：綠 ≥100%、橘 80-99%、紅 <80%
- 月份排序：最新在上（倒序），當月金色高亮（`#c99700`）

## Current Status

Phase 1 v2 Demo 儀表板已完成：5 頁籤（總覽、月度明細、週報追蹤、貼文分析、目標模擬器）。品牌識別已套用（Noto Sans TC + #c99700 金色系）。專案開發文件 v2.0 齊備，含 Phase 2 啟動 Checklist。

**GitHub repo**：https://github.com/terrelyeh/mingchu-dashboard（public）
**Vercel**：自動部署，git push 即上線

### 🔜 Next Steps

- **Phase 2 啟動**：取得 FB/IG 管理員權限 + 收齊歷史 Sheets → 建立 Supabase → Meta OAuth → Edge Functions → Next.js 前端
- **廣告成效分析**：Phase 2 串接 Marketing API 時再加（使用者確認不急）
- **W1/W2 觸及**：欄位已預留，Phase 2 Edge Function 於貼文發布 +7/+14 天撈取
- **Logo**：目前用文字「MINGCHU」，待取得適合尺寸的 Logo 檔再換回圖片
- 詳細啟動步驟見專案文件 Section 10

## Deployment

```bash
# 本地預覽（需 nvm）
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
npx serve -p 3000

# 部署（push to main 即自動部署到 Vercel）
git push origin main
```

## Key API Notes

- Meta 於 2025/11/15 棄用 `impressions` 和 `page_fans`，改用 `page_views` 和 `follower_count`
- FB 月 UU 需用 `period=month` 取得伺服器端去重數據
- IG 無 `period=month`，UU 只能用每日累計近似值，前端標「近似」
- Rate limit: ~200 calls/hour，需合併 metric 呼叫
- W1/W2 觸及：每篇貼文只需 2 次 API call（+7天、+14天），非每日撈取

## Common Pitfalls

- **不要用每日加總算 UU**：FB 必須用 `period=month`，IG 只能近似值且須標註
- **UU 不可跨平台加總**：月度明細在「全部」平台時隱藏 UU 欄位
- **目標來源衝突**：模擬器和 inline 編輯互相覆蓋，以最後操作為準，`goalSource` 追蹤來源
- **Phase 2 遷移**：Chart.js → Recharts，前端常數 → Supabase API，結構基本相容（見專案文件 Section 9.2 對應表）
- **Supabase service key 不可曝露前端**：必須透過 Next.js Server Components / Route Handlers
- **貼文分類只能人工標記**：API 無法判斷貼文類型，必須由使用者手動分類
- **IG 無連結點擊數**：Instagram API 不提供 link clicks，該欄位僅適用於 Facebook
- **Meta API token**：短期 token 僅 1-2 小時，Phase 2 用 OAuth + 自動續期
- **vercel.json 不可有 projectSettings**：schema validation 會報錯
