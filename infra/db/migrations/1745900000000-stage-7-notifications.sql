-- Stage 7: In-app notification inbox

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  type        VARCHAR(30) NOT NULL,   -- booking_confirmed | waitlist_upgraded | pt_verified | entry_denied | membership_expiring | announcement
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB,                  -- deep-link / action payload
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, created_at DESC);
