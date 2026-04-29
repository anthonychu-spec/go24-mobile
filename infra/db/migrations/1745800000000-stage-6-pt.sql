-- Stage 6: PT session verification logs

CREATE TABLE IF NOT EXISTS pt_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL,
  pgm_session_id TEXT,                    -- PGM session/usage ID
  pgm_trainer_id INTEGER,
  agreement_id   INTEGER,
  signed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signature      TEXT NOT NULL,           -- base64 PNG
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pt_logs_user    ON pt_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_pt_logs_session ON pt_logs(pgm_session_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pt_logs_session_unique
  ON pt_logs(user_id, pgm_session_id) WHERE pgm_session_id IS NOT NULL;
