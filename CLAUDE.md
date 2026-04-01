# CLAUDE.md — Project Context

> Last updated: 2026-04-01

## Project Overview

MINCHU 社群媒體儀表板專案，整合 Facebook 粉專與 Instagram 帳號的數據，建立互動式分析儀表板。最終目標是 Meta API 自動擷取 → 資料分析 → 目標追蹤 → 儀表板呈現的全自動管線。

## Tech Stack

### Phase 1（目前，Demo 用途）
- **前端**：純 HTML + Chart.js v4.5.1（自包含單一檔案）
- **文件產出**：docx-js (Node.js)

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
├── CLAUDE.md                     ← 本檔案
└── Social/
    ├── MINCHU_Social_Dashboard.html          ← 主要儀表板（Phase 1 成果）
    ├── MINCHU_Social_Dashboard_專案開發文件.docx  ← 專案文件（Word）
    ├── MINCHU_Social_Dashboard_專案開發文件.md    ← 專案文件（Markdown，給 AI agent 參考）
    ├── MINCHU_Social_Dashboard_專案開發文件.html  ← 專案文件（網頁版，團隊溝通用）
    ├── FB_自然觸及.png              ← 來源截圖（唯讀參考）
    ├── FB report.png
    ├── IG report.png
    ├── IG_自然觸及.png
    ├── 年累積數字.png
    └── 月重點(自然＿廣告).png
```

## Conventions

- 所有 UI 文字使用**繁體中文**
- 數據結構主要定義在 HTML 檔案內的 JavaScript 常數（`YEARLY_DATA`、`REACH_SUMMARY`、`PIC_DATA`、`GOALS`）
- UU（月不重複訪客）欄位目前為 `null`，待 Meta API `period=month` 接入後填入
- 缺失值前端顯示 `--` 加註「待接入」，不使用 0 替代
- 負責人：Clara Chang（FB）、Mike Chen（IG）

## Current Status

### ✅ Completed

- Phase 1 靜態儀表板：8 頁籤（含貼文分析、目標模擬器）、16+ 圖表、篩選器、KPI 卡片
- 歷史數據整理（2019–2025，從截圖與 Sheets 擷取）
- 篩選器互動（年份 + 平台切換，KPI 淡化效果）
- 負責人目標管理模組（週/月/季目標追蹤）
- 自然 vs 廣告觸及分析頁籤
- 月 UU 趨勢圖預留（含提示文字）
- 目標模擬器 Demo（互動式成長率滑桿 + 即時預覽圖表 + 模擬確認流程）
- 目標模擬器 Demo 模式提示（黃色提醒框，說明使用歷史數據示範）
- 目標模擬器預設基期改為最近有數據月份（2025/12）
- 專案開發文件（.docx + .md + .html）
- 技術決策確認：Next.js + shadcn/ui + Tailwind + Recharts + Supabase + Vercel
- GitHub repo 建立：https://github.com/terrelyeh/mingchu-dashboard（public）
- 貼文層級分析模組規格完成（Phase 2，含 API 欄位對照、DB schema、自動化流程）
- 貼文分析頁籤 Demo（分類成效圖表、發文日分析、單篇表格含批次分類操作）

### ⚠️ Pending / Known Issues

- **GitHub repo**：`mingchu-dashboard` 已建立 → https://github.com/terrelyeh/mingchu-dashboard
- **Supabase 接入**：Phase 2 尚未開始，需建立專案與 DB schema
- **Meta API 串接**：需取得 Facebook/Instagram 的 Page Access Token
- **Token 續期機制**：長期 token 60 天過期，需建自動續期
- **IG 月 UU 限制**：Instagram API 無 `period=month`，只能用每日累計近似值
- **2025/11 數據空窗**：`impressions` → `views` 轉換期需特殊處理
- **Google Sheets 原始數據**：尚未取得 CSV 匯出驗證儀表板數據正確性

## Key API Notes

- Meta 於 2025/11/15 棄用 `impressions` 和 `page_fans`，改用 `page_views` 和 `follower_count`
- FB 的月 UU 需用 `period=month` 取得伺服器端去重數據
- Rate limit: ~200 calls/hour，需合併 metric 呼叫
- 詳細 API 規格見 `Social/MINCHU_Social_Dashboard_專案開發文件.md`

## Common Pitfalls

- **不要用每日加總算 UU**：每日 reach 加總會嚴重高估實際人數，FB 必須用 `period=month`
- **IG 和 FB 的 UU 不可混用**：IG 只有近似值，前端需明確區分標註
- **Chart.js tooltip 中文**：確保所有 tooltip callback 輸出繁體中文
- **篩選器 vs 目標追蹤**：目標軌跡圖應固定顯示全年數據，不受年份/平台篩選影響
- **docx-js 產出**：表格需同時設定 `columnWidths` 和 cell `width`，否則渲染不一致
- **Meta API token**：短期 token 僅 1-2 小時，開發時需先換成長期 token
- **Phase 2 遷移注意**：Chart.js → Recharts，需重寫圖表元件；現有資料結構（YEARLY_DATA 等）可保留轉為 API 回傳格式
- **Supabase service key 不可曝露前端**：必須透過 Next.js Server Components / Route Handlers 存取
- **目標模擬器基期選擇**：Demo 版使用歷史數據，基期選過去月份等同「回測」；Phase 2 正式版應預設選最近有數據的月份，向未來推算
- **目標確認後的影響範圍**：確認目標後，成長率參數存入 Supabase，負責人目標、總覽 KPI 達成率、成長趨勢目標線、月度明細目標欄位都會自動更新
- **貼文分類只能人工標記**：API 無法判斷貼文類型（如 2B/2C/品牌聚焦），必須由使用者手動分類；分類選項存於 `post_categories` 表
- **IG 無連結點擊數**：Instagram API 不提供 link clicks 指標，該欄位僅適用於 Facebook
