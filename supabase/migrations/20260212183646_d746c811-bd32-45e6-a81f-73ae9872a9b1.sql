-- Backfill pack_id from raw_order for rows that have raw_order but no pack_id
UPDATE marketplace_transactions
SET pack_id = raw_order->>'pack_id'
WHERE pack_id IS NULL
  AND raw_order IS NOT NULL
  AND raw_order->>'pack_id' IS NOT NULL
  AND (raw_order->>'pack_id') != '';

-- Create index for pack_id lookups
CREATE INDEX IF NOT EXISTS idx_mkt_tx_pack_id ON marketplace_transactions(pack_id) WHERE pack_id IS NOT NULL;