-- Referral system
CREATE TABLE IF NOT EXISTS referrals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id      UUID NOT NULL,
  referrer_code    VARCHAR(12) NOT NULL UNIQUE,   -- short code e.g. "GO24-A3X9"
  referred_user_id UUID,                          -- filled when friend signs up
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','completed','rewarded')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer  ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code      ON referrals(referrer_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referred  ON referrals(referred_user_id);

-- Promotion banners
CREATE TABLE IF NOT EXISTS banners (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT,
  image_url     TEXT NOT NULL,
  link_url      TEXT,
  club_ids      JSONB,                  -- null = all clubs; ["TKP","WC"] = specific
  display_order INTEGER NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT true,
  start_at      TIMESTAMPTZ,
  end_at        TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(active, display_order)
  WHERE active = true;
