ALTER TABLE bounty_submissions
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN bounty_submissions.metadata IS
  'In-app CoinPay payment details for bounty payouts, such as payment address, crypto amount, payment currency, checkout URL, expiration, and transaction hashes.';
