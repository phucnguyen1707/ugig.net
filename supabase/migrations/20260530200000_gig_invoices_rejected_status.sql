-- Allow a payer to reject an invoice. Adds 'rejected' to the status CHECK
-- constraint (was: draft | sent | paid | cancelled | expired).
alter table gig_invoices
  drop constraint if exists gig_invoices_status_check;

alter table gig_invoices
  add constraint gig_invoices_status_check
  check (status in ('draft', 'sent', 'paid', 'cancelled', 'expired', 'rejected'));
