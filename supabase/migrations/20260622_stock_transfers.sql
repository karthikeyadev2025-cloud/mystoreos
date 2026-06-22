-- ─────────────────────────────────────────────────────────────────────────
-- Stock transfers between branches of the same brand. RK moves 20 shirts
-- from Main to Hitech City branch — instead of manually editing both
-- stock counts (and losing the audit trail), record an atomic transfer
-- voucher that decrements source and increments target in one shot.
--
-- Each row captures:
--   • from_shop_id / to_shop_id — the two branches involved
--   • items JSONB — list of {productId, productName, qty} actually moved
--     (productName denormalized so the voucher reads cleanly even if a
--     product is later renamed/deleted)
--   • created_by — the user who initiated the transfer (audit trail)
--   • note — optional free-text reason
--   • status — 'completed' on insert (no draft/pending states in v1;
--     transfers are immediate)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_transfers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_shop_id UUID NOT NULL REFERENCES users(id),
  to_shop_id   UUID NOT NULL REFERENCES users(id),
  items        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by   UUID NOT NULL REFERENCES users(id),
  note         TEXT,
  status       TEXT NOT NULL DEFAULT 'completed',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stock_transfers_from_idx ON stock_transfers (from_shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_transfers_to_idx   ON stock_transfers (to_shop_id, created_at DESC);
