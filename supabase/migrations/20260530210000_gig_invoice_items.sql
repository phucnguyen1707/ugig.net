-- Itemized line items for an invoice. The invoice's amount_usd remains the
-- authoritative total (and what CoinPay charges); items break it down.
create table if not exists gig_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references gig_invoices(id) on delete cascade,
  description text not null default '',
  amount_usd numeric not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_gig_invoice_items_invoice_id
  on gig_invoice_items(invoice_id);

alter table gig_invoice_items enable row level security;

-- Read items if you can read the parent invoice (worker or poster).
create policy "View invoice items you're involved in"
  on gig_invoice_items for select
  using (
    exists (
      select 1 from gig_invoices i
      where i.id = invoice_id
        and (i.worker_id = auth.uid() or i.poster_id = auth.uid())
    )
  );

-- Create items for an invoice you're party to (server uses the service role,
-- but keep this for completeness / session-client writes).
create policy "Create items for your invoices"
  on gig_invoice_items for insert
  with check (
    exists (
      select 1 from gig_invoices i
      where i.id = invoice_id
        and (i.worker_id = auth.uid() or i.poster_id = auth.uid())
    )
  );
