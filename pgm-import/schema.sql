-- ============================================
-- Perfect Gym Members Database Schema
-- Postgres 14+
-- ============================================

CREATE TABLE IF NOT EXISTS members (
  id                SERIAL PRIMARY KEY,
  member_code       VARCHAR(30) UNIQUE NOT NULL,
  name              VARCHAR(150),
  phone             VARCHAR(30),
  email             VARCHAR(150),
  gender            VARCHAR(10),
  dob               DATE,
  join_date         DATE,
  plan_type         VARCHAR(80),
  plan_start        DATE,
  plan_end          DATE,
  status            VARCHAR(30),
  pt_sessions_left  INT DEFAULT 0,
  last_visit        DATE,
  total_paid        NUMERIC(12,2),
  branch            VARCHAR(80),
  notes             TEXT,
  raw_data          JSONB,              -- 原始 PGM 數據 backup
  imported_at       TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_members_plan_end   ON members(plan_end);
CREATE INDEX IF NOT EXISTS idx_members_status     ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_phone      ON members(phone);
CREATE INDEX IF NOT EXISTS idx_members_name       ON members(name);
CREATE INDEX IF NOT EXISTS idx_members_branch     ON members(branch);
CREATE INDEX IF NOT EXISTS idx_members_last_visit ON members(last_visit);

-- Import log: 追蹤每日 import 結果
CREATE TABLE IF NOT EXISTS import_log (
  id             SERIAL PRIMARY KEY,
  source         VARCHAR(50),           -- 'pgm_daily_email'
  file_name      VARCHAR(255),
  rows_total     INT,
  rows_inserted  INT,
  rows_updated   INT,
  rows_failed    INT,
  error_message  TEXT,
  started_at     TIMESTAMP DEFAULT NOW(),
  finished_at    TIMESTAMP
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_members_updated ON members;
CREATE TRIGGER trg_members_updated
BEFORE UPDATE ON members
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
