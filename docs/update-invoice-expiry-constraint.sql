-- ArcFlow Pay migration: allow shorter invoice expiry options.
-- Run this once in Supabase SQL Editor.

alter table public.arcflow_invoices
  drop constraint if exists arcflow_invoices_expiry_check;

alter table public.arcflow_invoices
  add constraint arcflow_invoices_expiry_check
  check (expiry in ('6h', '12h', '24h', '3days', '7days'));
