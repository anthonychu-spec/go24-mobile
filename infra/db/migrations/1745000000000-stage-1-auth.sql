-- Stage 1 — Auth tables
-- Run after `CREATE EXTENSION uuid-ossp` (already in 01-extensions.sql)

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pgm_member_id   INT NOT NULL,
  email           VARCHAR(150),
  phone           VARCHAR(30),
  role            VARCHAR(20) NOT NULL DEFAULT 'member',
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  member_code     VARCHAR(30),
  trainer_code    VARCHAR(30),
  last_pgm_sync_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_users_pgm_member_id UNIQUE (pgm_member_id)
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

CREATE TABLE IF NOT EXISTS sessions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash  VARCHAR(200) NOT NULL,
  device_fingerprint  VARCHAR(200),
  device_platform     VARCHAR(50),
  revoked             BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_sessions_token_hash UNIQUE (refresh_token_hash)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id, revoked);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- updated_at auto-touch trigger (reuse pattern from existing pgm-import schema)
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_touch ON users;
CREATE TRIGGER trg_users_touch BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_sessions_touch ON sessions;
CREATE TRIGGER trg_sessions_touch BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
