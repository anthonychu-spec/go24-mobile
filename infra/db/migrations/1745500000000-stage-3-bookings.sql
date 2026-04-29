-- Stage 3: Booking write layer — bookings, booking_events, idempotency_keys, outbox_events

CREATE TABLE IF NOT EXISTS bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  class_id        INTEGER NOT NULL,
  external_id     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','failed','waitlist','cancelled','pending_verify','attended','no_show')),
  idempotency_key TEXT NOT NULL UNIQUE,
  pgm_member_id   INTEGER,
  error_code      VARCHAR(50),
  waitlist_position INTEGER,
  source          VARCHAR(10) NOT NULL DEFAULT 'local',
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at  TIMESTAMPTZ,
  CONSTRAINT confirmed_has_external CHECK (status != 'confirmed' OR external_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_status       ON bookings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_class_id          ON bookings(class_id);
CREATE INDEX IF NOT EXISTS idx_bookings_pending_old       ON bookings(created_at)  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_bookings_pending_verify    ON bookings(updated_at)  WHERE status = 'pending_verify';

CREATE TABLE IF NOT EXISTS booking_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  from_state  VARCHAR(20),
  to_state    VARCHAR(20) NOT NULL,
  reason      TEXT,
  actor       VARCHAR(100),
  at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_events_booking ON booking_events(booking_id);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  user_id      UUID NOT NULL,
  key          TEXT NOT NULL,
  endpoint     VARCHAR(100) NOT NULL,
  status       VARCHAR(12) NOT NULL DEFAULT 'in_flight'
               CHECK (status IN ('in_flight','done')),
  response     JSONB,
  result_kind  VARCHAR(12)
               CHECK (result_kind IN ('terminal','transient')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  PRIMARY KEY (user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_status  ON idempotency_keys(status, created_at);

CREATE TABLE IF NOT EXISTS outbox_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic         VARCHAR(100) NOT NULL,
  payload       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dispatched_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events(created_at) WHERE dispatched_at IS NULL;

-- Extend touch_updated_at trigger to bookings (function already created in Stage 1)
DO $$ BEGIN
  CREATE TRIGGER touch_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Hourly cleanup: DELETE FROM idempotency_keys WHERE expires_at < NOW();
-- (handled by ReconcileService cron)
