-- MINGCHU Social Media Dashboard — Schema v2 (Dynamic Workspaces)

-- 1. Allowed Users (Google Login whitelist)
CREATE TABLE allowed_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Workspaces
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Workspace Members (who can access which workspace)
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer',  -- 'admin' | 'viewer'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- 4. Meta OAuth Connections (per workspace)
CREATE TABLE meta_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,               -- 'facebook' | 'instagram'
  page_id TEXT NOT NULL,
  page_name TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  connected_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, platform)
);

-- 5. Follower Snapshots
CREATE TABLE follower_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  date DATE NOT NULL,
  follower_count INT NOT NULL,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, platform, date)
);

-- 6. Monthly Summary
CREATE TABLE monthly_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  reach_organic INT,
  reach_ad INT,
  reach_total INT,
  uu INT,
  uu_type TEXT DEFAULT 'manual',
  new_followers INT,
  engagement INT,
  link_clicks INT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, platform, year, month)
);

-- 7. Weekly Metrics
CREATE TABLE weekly_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  year INT NOT NULL,
  week INT NOT NULL,
  week_start DATE NOT NULL,
  reach INT,
  new_followers INT,
  engagement INT,
  line_friends INT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, platform, year, week)
);

-- 8. Goals
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  metric TEXT NOT NULL,
  pic TEXT,
  weekly_target INT,
  monthly_target INT,
  quarterly_target INT,
  annual_target INT,
  growth_rate DECIMAL(5,4),
  goal_source TEXT DEFAULT 'default',
  year INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, platform, metric, year)
);

-- 9. Post Categories (shared across workspaces)
CREATE TABLE post_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Posts
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  post_id TEXT UNIQUE NOT NULL,
  message TEXT,
  published_at TIMESTAMPTZ,
  organic_reach INT,
  total_engagement INT,
  link_clicks INT,
  reach_w1 INT,
  reach_w2 INT,
  category_id UUID REFERENCES post_categories(id),
  raw_insights JSONB,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Daily Metrics
CREATE TABLE daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  date DATE NOT NULL,
  reach_organic INT,
  reach_ad INT,
  new_followers INT,
  engagement INT,
  source TEXT DEFAULT 'api',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, platform, date)
);

-- 12. Indexes
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_follower_snapshots_ws ON follower_snapshots(workspace_id, date DESC);
CREATE INDEX idx_monthly_summary_ws ON monthly_summary(workspace_id, year DESC, month DESC);
CREATE INDEX idx_weekly_metrics_ws ON weekly_metrics(workspace_id, year DESC, week DESC);
CREATE INDEX idx_posts_ws ON posts(workspace_id, published_at DESC);
CREATE INDEX idx_posts_category ON posts(category_id);
CREATE INDEX idx_daily_metrics_ws ON daily_metrics(workspace_id, date DESC);

-- 13. Row Level Security
ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE follower_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;

-- Users can only see workspaces they belong to
CREATE POLICY "Members can read workspace" ON workspaces FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_id = workspaces.id AND user_id = auth.uid()
  ));

CREATE POLICY "Authenticated users can create workspace" ON workspaces FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM allowed_users WHERE email = auth.jwt()->>'email'));

CREATE POLICY "Members can read own memberships" ON workspace_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage members" ON workspace_members FOR ALL
  USING (EXISTS (
    SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid() AND wm.role = 'admin'
  ));

-- Data tables: members can read, admins can write
CREATE POLICY "Members can read" ON follower_snapshots FOR SELECT
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = follower_snapshots.workspace_id AND user_id = auth.uid()));

CREATE POLICY "Members can read" ON monthly_summary FOR SELECT
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = monthly_summary.workspace_id AND user_id = auth.uid()));

CREATE POLICY "Members can read" ON weekly_metrics FOR SELECT
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = weekly_metrics.workspace_id AND user_id = auth.uid()));

CREATE POLICY "Members can read" ON goals FOR SELECT
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = goals.workspace_id AND user_id = auth.uid()));

CREATE POLICY "Members can read" ON posts FOR SELECT
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = posts.workspace_id AND user_id = auth.uid()));

CREATE POLICY "Members can read" ON daily_metrics FOR SELECT
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = daily_metrics.workspace_id AND user_id = auth.uid()));

CREATE POLICY "Anyone can read categories" ON post_categories FOR SELECT
  USING (EXISTS (SELECT 1 FROM allowed_users WHERE email = auth.jwt()->>'email'));

CREATE POLICY "Admins can write" ON goals FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = goals.workspace_id AND user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update" ON goals FOR UPDATE
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = goals.workspace_id AND user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage posts" ON posts FOR ALL
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = posts.workspace_id AND user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage categories" ON post_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM allowed_users WHERE email = auth.jwt()->>'email'));

CREATE POLICY "Admins can manage connections" ON meta_connections FOR ALL
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = meta_connections.workspace_id AND user_id = auth.uid() AND role = 'admin'));

-- 14. Seed: Default post categories
INSERT INTO post_categories (name, color, sort_order) VALUES
  ('2B 採訪報導', '#4A90D9', 1),
  ('2C 餐飲食事', '#E67E22', 2),
  ('品牌聚焦', '#c99700', 3),
  ('產業動態', '#27AE60', 4),
  ('活動推廣', '#8E44AD', 5),
  ('其他', '#95A5A6', 99);

-- 15. Seed: Allowed users
INSERT INTO allowed_users (email, display_name) VALUES
  ('yoyoyo.chuhai@gmail.com', 'Terrel Yeh'),
  ('terrel.yeh@gmail.com', 'Terrelyeh'),
  ('perry.wu@gmail.com', 'Perry Wu');
