# MINCHU 社群媒體儀表板 — 專案介紹與開發文件

> 文件版本：v2.0
> 更新日期：2026-04-02
> 作者：Terrel Yeh

---

## 目錄

1. [專案總覽](#1-專案總覽)
   - 1.1 [專案背景](#11-專案背景)
   - 1.2 [專案範圍](#12-專案範圍)
   - 1.3 [目前成果](#13-目前成果)
2. [功能需求](#2-功能需求)
   - 2.1 [核心數據指標](#21-核心數據指標)
   - 2.2 [篩選器與互動功能](#22-篩選器與互動功能)
   - 2.3 [目標管理模組](#23-目標管理模組)
   - 2.4 [月 UU 整合計畫](#24-月-uuunique-users整合計畫)
   - 2.5 [目標模擬器模組](#25-目標模擬器模組)
   - 2.6 [貼文層級分析模組](#26-貼文層級分析模組phase-2)
   - 2.7 [資料來源標籤系統](#27-資料來源標籤系統)
3. [架構設計與部署建議](#3-架構設計與部署建議)
4. [API 相關資訊](#4-api-相關資訊)
5. [資料可行性分析](#5-資料可行性分析)
6. [Meta API 限制與風險評估](#6-meta-api-限制與風險評估)
7. [開發時程與優先級](#7-開發時程與優先級)
8. [技術決策與選型理由](#8-技術決策與選型理由)
9. [Phase 2 功能藍圖](#9-phase-2-功能藍圖)
10. [附錄](#附錄)

---

## 1. 專案總覽

### 1.1 專案背景

MINCHU 品牌目前同時經營 Facebook 粉絲專頁與 Instagram 帳號，需要一套統一的社群媒體分析儀表板，將分散在 Meta Business Suite、Google Sheets 與截圖中的數據整合為即時、可互動的視覺化報表。

本專案的最終目標是建立一條自動化數據管線：從 Meta API 自動擷取數據→資料分析與趨勢識別→目標追蹤→互動儀表板呈現。

### 1.2 專案範圍

- **平台範圍**：Facebook 粉絲專頁 + Instagram 商業帳號
- **數據範圍**：2019 年至今的歷史數據 + 即時 API 數據
- **內部報表整合**：原 8 張 Google Sheets 管理報表精簡為 5 個儀表板頁籤
- **技術方案**：Next.js + shadcn/ui + Recharts（前端）、Supabase（後端）、Vercel（部署）
- **負責人管理**：Clara Chang（FB）、Mike Chen（IG）

### 1.3 目前成果

已完成的儀表板原型（`MINCHU_Social_Dashboard.html`）包含 5 個頁籤、20+ 個互動圖表：

| 頁籤名稱 | 功能說明 |
|----------|---------|
| 總覽 | 年度 KPI 卡片（粉絲總數、本月觸及、新增追蹤、互動）、歷年粉絲成長趨勢圖（FB/IG/合計，hover 顯示全年對比 tooltip） |
| 月度明細 | 年份/平台篩選器（分組式 UI）、表格/圖表切換、月度數據含自然觸及/廣告觸及/總觸及/月 UU（FB 標「自動」、IG 標「近似」、全平台隱藏因不可跨平台加總）/新粉絲/互動/連結點擊/月成長率，資料來源標籤（自動/手動/計算）。YoY 比較、季度小計、年度合計。 |
| 週報追蹤 | FB/IG 分開的週報表格，含**週目標（可 inline 點擊編輯）**、每週達成率（綠/橘/紅三色）、月/季目標摘要行。**月份收合分組**（最新月份在上、金色高亮，舊月份收合）、未來 4 週自動產生待填行。**並排進度卡片**（當月累計 vs 目標，差距分析）、季度 pace projection。底部月度彙總表。目標與「目標模擬器」雙向連動。Line 數據區。 |
| 貼文分析 | Top 5 貼文卡片（可切換全部/FB/IG）、篩選器（平台/分類/排序，分組式 UI）、排序選項含「月份」可收合分組（顯示月匯總：篇數、總觸及、總互動、篇均觸及）、批次分類、分類成效比較圖。平台欄位以彩色標籤區分（FB 藍/IG 粉）。 |
| 目標模擬器 | 選擇指標/平台/基期（分組式篩選器），拖動成長率滑桿或選預設情境。圖表即時預覽 12 個月目標軌跡。結果區顯示**週/月/季目標三卡片**（週目標為核心同步值，金色高亮），含推導公式。確認後即時同步至週報追蹤。 |

---

## 2. 功能需求

### 2.1 核心數據指標

| 指標名稱 | 定義 | 來源 | 頁籤 |
|----------|------|------|------|
| 總粉絲數 | FB + IG 粉絲加總 | Meta API / 歷史資料 | 總覽、成長趨勢 |
| 觸及人數（自然） | 未付費觸及的人數 | Meta Graph API | 觸及分析、自然vs廣告 |
| 觸及人數（廣告） | 付費推廣觸及的人數 | Meta Ads API | 觸及分析、自然vs廣告 |
| 新增粉絲 | 當月新增追蹤數 | Meta Graph API | 成長趨勢、月度明細 |
| 月 UU | 當月不重複連線訪客 | Meta API period=month | 觸及分析、自然vs廣告、月度明細 |
| 互動數 | 讚、留言、分享、儲存 | Meta Graph API | 負責人目標 |

### 2.2 篩選器與互動功能

- **年份篩選**：切換不同年度的數據視角
- **平台篩選**：全部 / Facebook / Instagram 三種視角
- KPI 卡片即時回應篩選變更，未選平台之卡片自動淡化
- 圖表支援懸停顯示詳細數值（Chart.js tooltip）
- 目標達成追蹤固定顯示全年軌跡，不受篩選器影響

### 2.3 目標管理模組

目標設定支援兩種方式，可靈活搭配使用：

**方式一：Inline 手動編輯**
- 在週報追蹤頁面直接點擊週目標數字 → 彈出輸入框 → 輸入新值 → Enter 確認
- 系統自動推算月目標（×4）與季目標（×13），達成率即時重算

**方式二：目標模擬器同步**
- 在目標模擬器選擇指標、平台、基期與成長率 → 按確認
- 系統自動計算週/月/季目標並同步至週報追蹤，頁面自動跳轉

**目前目標設定值（Demo）：**

| 平台 | 負責人 | 週觸及目標 | 週追蹤目標 |
|------|--------|-----------|-----------|
| Facebook | Clara Chang | 27,500 | 138 |
| Instagram | Mike Chen | 7,500 | 88 |

**達成率顯示規則：**
- 🟢 綠色：≥ 100%（達標）
- 🟡 橘色：80–99%（接近）
- 🔴 紅色：< 80%（未達）

**差距分析**：月目標未達時，自動計算「距離月目標還差 X，剩餘 N 週需每週 Y」。

**Pace Projection**：以已完成週數推算季末預估達成率。

### 2.4 月 UU（Unique Users）整合計畫

月 UU 是反映實際不重複觸及人數的核心指標。經討論後，建議將月 UU 納入以下三個頁籤（而非僅限於月度明細）：

- **觸及分析**：新增「UU 趨勢圖」與現有觸及人數圖並列比較，提供「觸及 vs 實際人數」的分析視角
- **自然 vs 廣告**：在自然/廣告觸及對比中加入 UU 維度，評估廣告投放對「不重複人數」的實際貢獻
- **月度明細**：已預留 UU 欄位，待 API 接入後自動填入

> ⚠️ **注意**：UU 的取得必須使用 Meta API 的 `period=month` 參數，由伺服器端去重計算，絕對不可用每日數據加總替代。

**Phase 1 Demo 實作狀態：**
- 月度明細表格已新增「月 UU」欄位
- 選擇 FB 時顯示「自動」標籤，值為「待接入」（Phase 2 使用 `period=month` API）
- 選擇 IG 時顯示「近似」標籤（IG API 僅支援每日級別，無法取得跨日去重月 UU）
- 選擇全部平台時隱藏 UU 欄位（FB + IG 的 UU 不可跨平台加總）

### 2.5 目標模擬器模組

管理者目前在 Google Sheets 上手動模擬各項指標的目標成長率。為提升效率，儀表板新增「目標模擬器」頁籤，提供互動式目標設定工作流：

**Step 1 — 模擬探索（前端即時運算）**

- 選擇模擬指標：新增淨追蹤數 / 自然觸及人數
- 選擇基期月份（以哪個月的實際數據作為起算點，Demo 預設為最近有數據月份）
- 拖動成長率滑桿（0.5x ~ 3.0x）或快速選擇預設情境（保守/持平/穩健/積極/衝刺）
- 圖表即時顯示：實際數據柱狀圖 + 目標軌跡虛線，各月達成率卡片

> ⚠️ **Demo 模式說明**：目前使用 2025 歷史數據示範操作流程，正式版將以最新月份實際數據為基期，向未來推算目標。

**Step 2 — 確認同步**

- 點擊「確認此目標設定」，系統根據模擬結果即時更新 GOALS：
  - 週目標 = 下個月目標值 ÷ 4
  - 月目標 = 基期值 × (1 + 成長率)
  - 季目標 = 月目標 × 3
- **即時連動**：週報追蹤頁面的目標行、達成率、月進度條、差距分析全部自動重算
- 頁面自動跳轉至週報追蹤，使用者可立即驗證新目標的合理性
- **結果區三卡片顯示**：
  - 週目標（金色高亮）= 月目標 ÷ 4（確認後同步至週報追蹤的值）
  - 月目標 = 基期值 × (1 + 成長率)
  - 季目標 = 月目標 × 3
- 下方補充顯示第 12 個月目標值與年度累計目標
- Phase 2 正式版：確認後將成長率參數寫入 Supabase `goals` 表，所有頁面即時更新

**目標計算邏輯：**

```
目標值[月份 N] = 基期實際值 × 成長率係數 ^ ((N - 基期月份) / 6)
```

> Supabase 存的是「成長率參數」而非每月目標數字，管理者隨時可回來調整，所有頁面即時更新。

### 2.6 貼文層級分析模組（Phase 2）

目前 FB 與 IG 的單篇貼文成效數據由團隊手動維護於 Google Sheets，包含每篇貼文的自然觸及、總互動數、連結點擊數等指標，以及手動標記的貼文分類。Phase 2 將透過 API 自動化此流程。

**API 可自動取得的欄位：**

| 欄位 | Facebook API | Instagram API |
|------|-------------|---------------|
| 貼文內容/標題 | `message` 欄位 | `caption` 欄位 |
| 發佈日期 | `created_time` | `timestamp` |
| 自然觸及人數 | `post_impressions_organic_unique` | `reach` |
| 總互動數 | `post_engaged_users` | `total_interactions`（或 likes + comments + shares + saved） |
| 連結點擊數 | `post_clicks` / `post_clicks_by_type` | — (IG 無此指標) |
| 連結點擊率 | 由連結點擊數 ÷ 自然觸及計算 | — |

**需人工操作的欄位：**

- **貼文分類**：如「2B 採訪報導」「2C 餐飲食事」「品牌聚焦」「產業動態」等，由使用者從下拉選單選取
- 分類選項存於 `post_categories` 表，可隨時新增/修改

**資料庫設計：**

```sql
-- 貼文資料表
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,          -- 'facebook' | 'instagram'
  post_id TEXT UNIQUE NOT NULL,    -- Meta API 的貼文 ID
  message TEXT,                    -- 貼文內容
  published_at TIMESTAMPTZ,        -- 發佈時間
  organic_reach INT,               -- 自然觸及人數
  total_engagement INT,            -- 總互動數
  link_clicks INT,                 -- 連結點擊數（FB only）
  category_id UUID REFERENCES post_categories(id),  -- 人工分類
  raw_insights JSONB,              -- API 原始回傳（備查）
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 貼文分類表
CREATE TABLE post_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,              -- e.g. '2B 採訪報導'
  color TEXT,                      -- 圖表配色
  sort_order INT DEFAULT 0
);
```

**自動化流程：**

1. Supabase Edge Function 每日排程呼叫 `GET /{page-id}/posts` 與 `GET /{ig-user-id}/media`，抓取前一天新增的貼文
2. 對每篇新貼文呼叫 `GET /{post-id}/insights` 或 `GET /{media-id}/insights`，取得成效指標
3. 寫入 `posts` 表，`category_id` 預設為空
4. 使用者進入儀表板「貼文分析」頁面，看到未分類貼文，從下拉選單選擇分類即可

**儀表板分析功能（Phase 2 新增頁籤）：**

- 週彙總表：貼文總觸及、貼文總互動（由 SQL 自動加總，取代手動計算）
- 分類成效比較：各分類的平均觸及 / 互動 / 點擊率
- 發文時間分析：星期幾 × 時段的成效熱力圖
- 單篇 Top N 排行：依觸及或互動排序的最佳貼文

### 2.7 資料來源標籤系統

儀表板中所有數據欄位均標註資料來源，幫助使用者理解每筆數據的取得方式與可信度：

| 標籤 | 顏色 | 意義 | 範例 |
|------|------|------|------|
| 自動 | 藍色 | Meta API 自動擷取 | 自然觸及、新增追蹤、互動數 |
| 手動 | 橘色 | 需人工輸入或維護 | 貼文分類、週目標設定、Line 數據 |
| 計算 | 紫色 | 由其他欄位推導計算 | 點擊率（連結點擊 ÷ 觸及）、達成率 |

Phase 2 正式版中，「自動」標籤的欄位將由 Supabase Edge Functions 定時從 Meta API 寫入；「手動」標籤的欄位由使用者在儀表板介面上操作；「計算」標籤的欄位由前端或 SQL computed column 產生。

---

## 3. 架構設計與部署建議

### 3.1 系統架構圖

推薦採用中量級架構，具備良好的擴展性與維護性：

| 層級 | 元件 | 說明 |
|------|------|------|
| 數據來源 | Meta Graph API / Ads API | 定期擷取 FB + IG 的指標數據 |
| 數據擷取 | Supabase Edge Functions + pg_cron | 無伺服器函數，排程執行 API 調用 |
| 數據儲存 | Supabase (PostgreSQL) | 結構化儲存每日/每月指標數據，RLS 權限控管 |
| 前端框架 | Next.js 14+ (App Router) | Server Components 保護 API 金鑰，SSR/SSG 支援 |
| UI 元件庫 | shadcn/ui + Tailwind CSS | 可控、輕量、AI Agent 友好的元件系統 |
| 圖表 | Recharts | React 原生元件，shadcn/ui 官方整合 |
| 認證（選配） | Supabase Auth | 限制團隊登入才能查看儀表板 |
| 部署 | Vercel | git push 即部署，Next.js 原生整合 |

### 3.2 三階段漸進式開發

#### Phase 1：靜態儀表板（已完成，v2 優化版）

- 整合 8 張內部管理報表，精簡為 5 個頁籤（總覽、月度明細、週報追蹤、貼文分析、目標模擬器）
- 自包含 HTML + Chart.js v4.5.1，零依賴部署
- 資料來源標籤系統（自動/手動/計算）標註所有欄位
- 目標 inline 編輯 + 模擬器雙向連動
- 貼文分析月份收合、Top 5 平台切換、分組式篩選器
- 舊版 9 頁籤儀表板保留為 v1 archive 供團隊參考
- 部署於 Vercel（GitHub 自動部署），landing page 提供 v2 / v1 / 文件入口

#### Phase 2：API 自動化接入

- 建立 Supabase 專案與資料庫 schema
- 開發 Edge Functions 執行 Meta API 擷取
- 設定 cron job 每日自動拉取數據
- 以 Next.js App Router 重寫前端，Chart.js 遷移至 Recharts
- UI 採用 shadcn/ui + Tailwind CSS，前端從 Supabase REST API 讀取數據
- Supabase service key 透過 Next.js Server Components / Route Handlers 存取，不暴露前端

#### Phase 3：進階功能

- 自動異常警報（當指標偏離目標時通知）
- 歷史數據回填與資料比對
- AI 趨勢分析與建議

### 3.3 資料庫 Schema 設計（建議）

| 表名 | 主要欄位 | 說明 |
|------|---------|------|
| `daily_metrics` | date, platform, reach_organic, reach_ad, new_followers, engagement | 每日指標原始數據 |
| `monthly_summary` | year, month, platform, total_reach, uu, new_followers | 月度彙總數據（含 UU） |
| `goals` | year, platform, pic, weekly_target, monthly_target, quarterly_target | 目標設定 |
| `follower_snapshots` | date, platform, follower_count | 粉絲數快照（每日記錄） |
| `posts` | platform, post_id, message, published_at, organic_reach, total_engagement, link_clicks, category_id, raw_insights | 貼文層級數據 |
| `post_categories` | name, color, sort_order | 貼文分類（人工標記） |
| `weekly_metrics` | year, week, platform, reach, new_followers, engagement | 週報追蹤數據 |

> ⚠️ **Multi-workspace**：以上所有表均需加入 `workspace_id` 欄位，並設定 RLS policy 按 workspace 隔離。從 Phase 2 第一天就設計進去。

---

## 4. API 相關資訊

### 4.1 會用到的 API 總覽

| API 名稱 | 用途 | 對應指標 |
|----------|------|---------|
| Facebook Graph API v21.0 | FB 粉專指標 | 粉絲、觸及、UU |
| Instagram Graph API | IG 商業帳號指標 | 粉絲、觸及、互動 |
| Marketing API (Ads) | 廣告投放數據 | 廣告觸及、花費、轉換 |

### 4.2 Facebook Graph API 端點與參數

#### 4.2.1 粉絲專頁 Insights

**Endpoint:** `GET /{page-id}/insights`

| 參數 | 值 | 說明 |
|------|---|------|
| `metric` | `page_views, page_post_engagements, page_fans_online` | 指定要查詢的指標 |
| `period` | `day / week / days_28 / month` | 聚合週期，UU 必須用 `month` |
| `since / until` | UNIX timestamp 或 ISO 8601 | 查詢的時間範圍 |
| `access_token` | Page Access Token | 必須為長期不過期的 token |

#### 4.2.2 重要指標變更（2025/11 起）

> 🔴 **重大變更**：Meta 已於 2025 年 11 月 15 日棄用 `impressions` 和 `page_fans` 指標。

| 舊指標（已棄用） | 新指標 | 差異說明 |
|------------------|--------|---------|
| `page_impressions` | `page_views` | 「views」只計完整載入，數字會較低 |
| `page_fans` | （無直接替代） | 需透過 `follower_count` 快照取得 |
| `page_impressions_unique` | `page_views_unique` (UU) | 必須搭配 `period=month` 使用 |

**數據空窗期**：由於 API 轉換，2025 年 11 月至 2026 年初的數據可能需要額外處理，建議在此期間同時保留舊與新指標以確保數據連續性。

### 4.3 Instagram Graph API 端點與參數

**Endpoint:** `GET /{ig-user-id}/insights`

| 參數 | 值 | 說明 |
|------|---|------|
| `metric` | `reach, impressions, follower_count, profile_views` | 查詢指標 |
| `period` | `day / week / days_28` | IG 目前不支援 `month` 週期 |
| `metric_type` | `total_value` | 取得加總值 |
| `since / until` | UNIX timestamp | 最遠可回查 2 年 |

> ⚠️ **IG 特殊限制**：Instagram 的 reach 指標目前僅提供每日級別數據，無法透過 API 取得跨日去重的月 UU。每日加總會高估實際人數。

### 4.4 Marketing API（廣告數據）

**Endpoint:** `GET /act_{ad-account-id}/insights`

| 參數 | 值 | 說明 |
|------|---|------|
| `fields` | `reach, impressions, spend, actions` | 廣告觸及、曝光、花費、轉換行為 |
| `time_range` | `{"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}` | 查詢廣告組的時間範圍 |
| `level` | `campaign / adset / ad` | 資料聚合層級 |
| `breakdowns` | `publisher_platform` | 可區分 FB / IG 廣告效果 |

### 4.5 API 擷取策略

| 擷取任務 | 頻率 | 策略說明 |
|----------|------|---------|
| 每日指標 | 每日 02:00 UTC | 拉取前一天的 reach、engagement、new_followers |
| 月 UU (FB) | 每月 2 號 | 使用 `period=month` 拉取上月的去重人數 |
| 粉絲快照 | 每日 02:00 UTC | 記錄當前 `follower_count` 作為歷史快照 |
| 廣告數據 | 每日 06:00 UTC | 廣告數據有延遲，預留 6 小時緩衝 |
| 歷史回填 | 一次性 | 初始化時拉取過去 2 年可用數據 |

> **Rate Limit 注意**：Meta API 每小時上限約 200 次呼叫（依 app 級別而定）。建議每次調用合併多個 metric，並於調用間加入 1-2 秒延遲。

---

## 5. 資料可行性分析

### 5.1 可實現的數據

| 數據項目 | FB 可行性 | IG 可行性 | 備註 |
|----------|----------|----------|------|
| 粉絲數 | ✅ `follower_count` | ✅ `followers_count` | 即時取得 |
| 自然觸及 | ✅ `page_views` | ✅ `reach` (day) | FB 用 views（新指標） |
| 廣告觸及 | ✅ Ads API | ✅ Ads API | 透過 Marketing API 取得 |
| 新增粉絲 | ✅ `page_fan_adds` | ✅ `follower_count` diff | IG 需用快照差值計算 |
| 互動數 | ✅ `page_post_engagements` | ✅ `likes, comments, shares` | 均可透過 API 取得 |
| 月 UU | ✅ `period=month` | ⚠️ 僅日級加總 | IG 無法取得真實月 UU |

### 5.2 無法實現或有限制的數據

- **IG 月 UU**：Instagram API 不提供 `period=month`，無法取得跨日去重人數。建議方案：使用每日加總並於前端標註「每日累計，實際人數可能較低」。
- **歷史 impressions**：2025/11 前的 impressions 數據已無法透過 API 重新查詢，需依賴已保存的歷史資料。
- **page_fans 歷史**：已棄用，需用 `follower_count` 快照替代，但無法回溯快照前的數據。
- **跨平台去重**：FB 與 IG 的 UU 無法跨平台去重，「總觸及 UU」只能用 FB UU + IG UU，實際人數可能因重疊而較低。

### 5.3 數據清理與整理策略

| 數據情境 | 處理策略 |
|----------|---------|
| 2019–2025/10 歷史數據 | 使用已存在的 Google Sheets / 截圖數據作為基線，導入資料庫 |
| 2025/11 轉換期 | 同時保留舊指標與新指標，以係數轉換確保連續性 |
| 2026 起新數據 | 全面使用新 API 指標，自動化擷取入庫 |
| 缺失值處理 | 前端顯示「--」並加註「待接入」，不使用 0 替代 |
| IG UU 近似值 | 標註「每日累計」與 FB UU（已去重）區分顯示 |

---

## 6. Meta API 限制與風險評估

### 6.1 同事提出的擔憂與回應

團隊同事對於 Meta API 的變動提出了幾點重要擔憂，以下逐點分析其有效性與應對方案：

| 同事擔憂 | 評估 | 建議應對方案 |
|----------|------|-------------|
| impressions 和 page_fans 已棄用，無法取得數據 | ✅ 確實正確。但有替代方案。 | 改用 `page_views` 和 `follower_count` 快照，數字會有差異但趨勢一致 |
| 觸及人數無法去重，加總會高估 | ⚠️ 部分正確。FB 可去重，IG 不可。 | FB 用 `period=month` 取得真實 UU；IG 用每日加總並標註 |
| API 數據不穩定，變動太頻繁 | ⚠️ 過於悲觀。每次棄用有預告期。 | 開發時預留指標對照表，新版本發布時快速調整 |
| 擔心開發後又要重新調整 | ⚠️ 合理擔憂，但可透過架構緩解。 | 採用「指標對照層」抽象設計，未來只需更新對照表而非整個系統 |

### 6.2 註冊之主要 API 限制

| 限制類型 | 內容 | 影響 |
|----------|------|------|
| Rate Limiting | 每小時 ~200 次呼叫（App-level） | 需合併調用，避免對單一指標獨立請求 |
| Token 過期 | 短期 token 1-2 小時，長期 60 天 | 必須建立 token 自動續期機制 |
| 數據回溯 | Insights 最遠 2 年，Ads 最遠 37 個月 | 歷史數據超過此範圍需依賴手動備份 |
| 棄用變更 | 平均每年會有指標變動 | 採用指標抽象層減少影響 |
| IG 去重限制 | 僅支援 day / week / days_28 | 無法取得真實月 UU |

### 6.3 風險緩解架構：指標對照層

為了因應 Meta API 的頻繁變動，建議在架構中加入「指標對照層」（Metric Mapping Layer）：

- **對照表設計**：建立「業務指標名稱 → API 指標名稱」的對應關係表
- **快速調整**：Meta 變更指標時，只需更新對照表，前端與資料庫均不受影響
- **版本管理**：對照表納入版控，記錄每次 API 版本更新的對應調整

---

## 7. 開發時程與優先級

| 階段 | 時程 | 主要任務 | 交付物 |
|------|------|---------|--------|
| Phase 1 | 已完成 | 靜態儀表板原型 | `MINCHU_Social_Dashboard.html` |
| Phase 2a | 第 1–2 週 | 建立 Supabase + DB schema | 資料庫與歷史數據導入 |
| Phase 2b | 第 3–4 週 | 開發 Edge Functions + API 串接 | 自動化數據擷取運作 |
| Phase 2c | 第 5–6 週 | 前端對接 API + UU 整合 | 即時數據儀表板 |
| Phase 3 | 第 7–8 週 | 警報機制、AI 分析 | 完整產品 |

---

## 8. 技術決策與選型理由

| 層級 | 選擇 | 選型理由 |
|------|------|---------|
| 前端框架 | Next.js 14+ (App Router) | Server Components 保護 API 金鑰不暴露前端；與 Vercel 原生整合，部署零配置；`@supabase/ssr` 有一等支援 |
| UI 元件庫 | shadcn/ui | 複製原始碼進專案，完全可控不受套件版本影響；底層 Radix UI + Tailwind，品質穩定；AI Coding Agent 支援成熟 |
| CSS | Tailwind CSS | shadcn/ui 標配；AI Agent 產出品質穩定；響應式、深色模式快速實現 |
| 圖表 | Recharts | React 原生元件，與 state 管理自然銜接；shadcn/ui 官方 chart 元件基於 Recharts；取代 Phase 1 的 Chart.js |
| 後端 / 資料庫 | Supabase (PostgreSQL) | Free Tier 足夠（500MB DB、5GB 頻寬）；RLS 權限控管；Edge Functions 處理排程 |
| 排程 | Supabase Edge Functions + pg_cron | 不需依賴 Vercel Pro Plan 的 cron；資料擷取與儲存在同一平台，架構簡單 |
| 部署 | Vercel | Next.js 同公司產品，原生整合；git push 即部署；免費額度足夠內部使用 |
| 認證（選配） | Supabase Auth | 若需限制團隊登入，Supabase Auth + Next.js middleware 可快速實現 |

> **Phase 1 → Phase 2 遷移注意**：現有 HTML 檔案中的資料結構（`YEARLY_FANS`、`MONTHLY_DATA`、`WEEKLY_DATA`、`GOALS`、`POST_DATA`、`POST_CATEGORIES`）可直接對應至 Supabase 資料表結構。Chart.js 圖表需以 Recharts 元件重寫。目標 inline 編輯與模擬器連動邏輯可保留，改為呼叫 Supabase API 讀寫。

---

## 9. Phase 2 功能藍圖

### 9.1 認證與權限

- **登入方式**：Google Social Login（Supabase Auth 原生支援）
- **權限控管**：初期採白名單機制，`allowed_users` 表存放允許登入的 email
- **未來擴充**：可升級為角色權限（管理者可設目標、編輯只能查看報表）

### 9.2 Multi-workspace 架構

- 一個帳號可管理多個 workspace（例：兩間分公司獨立資料）
- 所有資料表加 `workspace_id` 欄位，RLS policy 按 workspace 隔離
- 前端提供 workspace 切換器，切換後所有頁面資料即時更新
- **建議從 Phase 2 第一天就設計進去**，後面加比重構容易

**Phase 1 → Phase 2 資料結構對應：**

| Phase 1 前端常數 | Phase 2 Supabase 表 | 說明 |
|------------------|---------------------|------|
| `YEARLY_FANS` | `follower_snapshots` | 歷年粉絲數快照 |
| `MONTHLY_DATA` | `monthly_summary` | 月度彙總數據 |
| `WEEKLY_DATA` | `weekly_metrics` | 週報追蹤數據 |
| `GOALS` | `goals` | 目標設定（含成長率參數） |
| `POST_DATA` | `posts` | 貼文層級數據 |
| `POST_CATEGORIES` | `post_categories` | 分類選項 |

遷移時，前端從 `const` 改為呼叫 Supabase REST API 或 Next.js Server Component 取得資料，資料結構基本相容。

### 9.3 Meta API OAuth 自助串接

- 管理者進到「設定」頁面，點「連接 Facebook 粉專」→ 跳出 Meta OAuth 授權視窗
- 系統取得 token 後自動存入 Supabase 加密欄位，綁定對應 workspace
- Edge Function 定期檢查 token 有效期，快過期時自動續期
- 每個 workspace 獨立 token，互不影響

### 9.4 廣告成效分析模組

- **資料來源**：Meta Marketing API（Ad Account Insights + per-ad Post ID 交叉比對）
- **核心指標**：廣告花費、CPM（每千次曝光成本）、CPC（每次點擊成本）、CTR（點擊率）
- **月度彙總圖表**：月度花費 vs 觸及（雙 Y 軸）、CPM/CPC 趨勢線、CTR 效率圖、明細表格
- **推廣貼文明細**：按月份分組，可展開 / 收合查看該月所有被 boost 的貼文，每則顯示平台、標題、花費、觸及、曝光、點擊、CPM、CPC、CTR
- **用途**：評估廣告預算分配效率，並可追溯每筆花費對應的具體內容
- Demo 版已用 Mock Data 呈現月度彙總 + 推廣貼文明細（`AD_PERF_DATA` + `AD_PROMOTED_POSTS`）

### 9.5 互動率趨勢

- **計算方式**：互動率 = 總互動數 ÷ 自然觸及人數
- **意義**：觸及可能因廣告投放波動，互動率才反映內容品質
- **呈現**：FB / IG 雙線趨勢圖，含整體平均 tooltip
- Demo 版已用 Mock Data 呈現於「成長趨勢」頁籤

### 9.6 受眾輪廓（規劃中）

- **資料來源**：Meta API `page/insights`（`page_fans_gender_age`、`page_fans_city`）
- **圖表**：年齡 × 性別分布柱狀圖、地區 Top 10
- **用途**：了解追蹤者組成，優化內容策略與廣告受眾設定

### 9.7 Reels / Stories 分類分析（規劃中）

- **資料來源**：Instagram API `media_type` 欄位（IMAGE / VIDEO / CAROUSEL / REEL）
- **整合位置**：貼文分析頁籤新增「格式」篩選維度
- **圖表**：各格式平均觸及 / 互動比較，評估短影音 vs 圖文的成效差異

### 9.8 導流追蹤（規劃中，需 GA4）

- **資料來源**：Google Analytics 4 API（需額外串接）
- **指標**：社群來源的網站造訪數、跳出率、轉換率
- **前提**：需在貼文連結中加入 UTM 參數
- **優先級較低**，待核心功能穩定後再評估

---

## 附錄

### 附錄 A：Meta API 版本變更時間軸

| 日期 | 事件 | 影響 |
|------|------|------|
| 2025/11/15 | `impressions`、`page_fans` 棄用 | 需改用 `views`、`follower_count` |
| 2025/11/15 | 新增 `page_views` 指標 | 替代 impressions，數字略低 |
| 2026 Q2（預估） | Graph API v22.0 發布 | 需檢查是否有新棄用指標 |

### 附錄 B：用語對照表

| 中文術語 | 英文術語 | API 對應 |
|----------|---------|---------|
| 觸及人數 | Reach | `page_views` / `reach` |
| 月不重複訪客 | Monthly Unique Users (UU) | `page_views_unique` (`period=month`) |
| 自然觸及 | Organic Reach | `page_views` (organic) |
| 廣告觸及 | Paid/Ad Reach | Ads API `reach` |
| 粉絲數 | Follower Count | `follower_count` |
| 新增粉絲 | New Followers | `page_fan_adds` / `follower_count` diff |
| 互動數 | Engagement | `page_post_engagements` |
