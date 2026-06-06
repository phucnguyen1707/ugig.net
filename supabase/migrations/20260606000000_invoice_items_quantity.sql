-- Add quantity and unit_price_usd to gig_invoice_items so workers can enter
-- "PRs merged (qty: 4 × $2.00 = $8.00)" style line items.
-- amount_usd remains the authoritative line total (quantity * unit_price_usd).
-- Existing rows get quantity = 1, unit_price_usd = amount_usd (no data change).

alter table gig_invoice_items
  add column if not exists quantity numeric not null default 1,
  add column if not exists unit_price_usd numeric;

-- Back-fill unit_price_usd for existing rows so the display is consistent.
update gig_invoice_items
  set unit_price_usd = amount_usd
  where unit_price_usd is null;

alter table gig_invoice_items
  alter column unit_price_usd set not null,
  alter column unit_price_usd set default 0;
