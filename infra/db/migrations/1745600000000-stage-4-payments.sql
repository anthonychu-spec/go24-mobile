-- Stage 4: Payment methods (Adyen card tokenization)

CREATE TABLE IF NOT EXISTS payment_methods (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL,
  shopper_reference         TEXT NOT NULL,           -- Adyen shopperReference (= user UUID)
  recurring_detail_ref      TEXT,                    -- Adyen recurringDetailReference (card token)
  card_summary              VARCHAR(4),              -- last 4 digits (display only)
  card_brand                VARCHAR(20),             -- visa / mc / amex
  expiry_month              VARCHAR(2),
  expiry_year               VARCHAR(4),
  status                    VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','active','failed','expired')),
  adyen_environment         VARCHAR(10) NOT NULL DEFAULT 'TEST',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_user_active
  ON payment_methods(user_id) WHERE status = 'active';

DO $$ BEGIN
  CREATE TRIGGER touch_payment_methods_updated_at
    BEFORE UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
