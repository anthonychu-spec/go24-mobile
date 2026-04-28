-- Initial schema: users + sessions

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pgm_member_id INTEGER NOT NULL,
  email         VARCHAR(150),
  phone         VARCHAR(30),
  role          VARCHAR(20) NOT NULL DEFAULT 'member',
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  member_code   VARCHAR(30),
  trainer_code  VARCHAR(30),
  last_pgm_sync_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_pgm_member_id ON users(pgm_member_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL,
  refresh_token_hash  VARCHAR(200) NOT NULL,
  device_fingerprint  VARCHAR(200),
  device_platform     VARCHAR(50),
  revoked             BOOLEAN NOT NULL DEFAULT false,
  last_seen_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id, revoked);
