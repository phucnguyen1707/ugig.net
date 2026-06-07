-- Allow a bounty creator to reject a payout (e.g. submitter has no CoinPay
-- wallet connected). Adds 'rejected' to the payout_status CHECK constraint
-- (was: unpaid | invoiced | paid). Also adds a metadata column so we can
-- store a rejection reason.
alter table bounty_submissions
  drop constraint if exists bounty_submissions_payout_status_check;

alter table bounty_submissions
  add constraint bounty_submissions_payout_status_check
  check (payout_status in ('unpaid', 'invoiced', 'paid', 'rejected'));
