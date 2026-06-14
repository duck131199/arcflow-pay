-- Add real payer/payment identity fields to Arqis invoices.
-- Run this once in Supabase SQL Editor.

alter table public.arcflow_invoices
  add column if not exists paid_by_username text references public.arcflow_users(username),
  add column if not exists paid_by_wallet text,
  add column if not exists paid_amount numeric(38, 6),
  add column if not exists paid_token text,
  add column if not exists payment_recorded_at timestamptz;

alter table public.arcflow_invoices
  add constraint arcflow_invoices_paid_by_wallet_format
  check (paid_by_wallet is null or paid_by_wallet ~ '^0x[0-9a-fA-F]{40}$') not valid;

create index if not exists arcflow_invoices_paid_by_username_idx
  on public.arcflow_invoices(paid_by_username, paid_at desc);

create index if not exists arcflow_invoices_tx_hash_idx
  on public.arcflow_invoices(tx_hash)
  where tx_hash is not null;

-- Backfill existing paid invoices so old records still show payer data.
update public.arcflow_invoices
set
  paid_by_username = coalesce(paid_by_username, to_username),
  paid_by_wallet = coalesce(paid_by_wallet, to_wallet),
  paid_amount = coalesce(paid_amount, amount),
  paid_token = coalesce(paid_token, token),
  payment_recorded_at = coalesce(payment_recorded_at, paid_at)
where paid_at is not null;
