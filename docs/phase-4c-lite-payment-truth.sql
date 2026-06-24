-- Phase 4C-lite: Payment truth foundation
-- Run this once in Supabase SQL Editor after docs/supabase-schema.sql.
-- Safe/idempotent draft: adds fields used by future swap/unified payment receipts
-- without changing the current Arc Testnet USDC payment flow.

-- 1) User-facing invoice status: add failed while preserving existing statuses.
alter table if exists public.arcflow_invoices
  drop constraint if exists arcflow_invoices_status_check;

alter table if exists public.arcflow_invoices
  add constraint arcflow_invoices_status_check
  check (status in ('unpaid', 'pending', 'paid', 'expired', 'failed', 'cancelled'));

-- 2) Payment method + internal payment lifecycle.
alter table if exists public.arcflow_invoices
  add column if not exists payment_method text not null default 'standard_arc_usdc',
  add column if not exists payment_status text not null default 'created',
  add column if not exists receipt_version text not null default '1.1',
  add column if not exists verified_at timestamptz,
  add column if not exists settlement_chain text not null default 'arc-testnet',
  add column if not exists source_chains jsonb not null default '["arc-testnet"]'::jsonb,
  add column if not exists verification_checks jsonb not null default '{}'::jsonb,
  add column if not exists failure_reason text;

alter table if exists public.arcflow_invoices
  drop constraint if exists arcflow_invoices_payment_method_check;

alter table if exists public.arcflow_invoices
  add constraint arcflow_invoices_payment_method_check
  check (payment_method in (
    'standard_arc_usdc',
    'swap_to_usdc',
    'unified_invoice_pay',
    'instant_settlement',
    'direct_receive',
    'unknown'
  ));

alter table if exists public.arcflow_invoices
  drop constraint if exists arcflow_invoices_payment_status_check;

alter table if exists public.arcflow_invoices
  add constraint arcflow_invoices_payment_status_check
  check (payment_status in (
    'created',
    'awaiting_signature',
    'submitted',
    'confirming',
    'verifying',
    'settled',
    'completed',
    'failed',
    'manual_review'
  ));

alter table if exists public.arcflow_invoices
  drop constraint if exists arcflow_invoices_receipt_version_check;

alter table if exists public.arcflow_invoices
  add constraint arcflow_invoices_receipt_version_check
  check (receipt_version in ('1.0', '1.1'));

alter table if exists public.arcflow_invoices
  drop constraint if exists arcflow_invoices_settlement_chain_check;

alter table if exists public.arcflow_invoices
  add constraint arcflow_invoices_settlement_chain_check
  check (settlement_chain in (
    'arc-testnet',
    'base-sepolia',
    'ethereum-sepolia',
    'arbitrum-sepolia',
    'polygon-amoy',
    'op-sepolia',
    'unknown'
  ));

create index if not exists arcflow_invoices_payment_method_idx
  on public.arcflow_invoices(payment_method, created_at desc);

create index if not exists arcflow_invoices_payment_status_idx
  on public.arcflow_invoices(payment_status, created_at desc);

create index if not exists arcflow_invoices_verified_at_idx
  on public.arcflow_invoices(verified_at desc)
  where verified_at is not null;

-- 3) Backfill current paid/pending rows into the new lifecycle fields.
update public.arcflow_invoices
set
  payment_method = coalesce(payment_method, 'standard_arc_usdc'),
  receipt_version = coalesce(receipt_version, '1.1'),
  settlement_chain = coalesce(settlement_chain, 'arc-testnet'),
  source_chains = coalesce(source_chains, '["arc-testnet"]'::jsonb),
  verified_at = coalesce(verified_at, paid_at),
  payment_status = case
    when status = 'paid' then 'completed'
    when status = 'pending' and tx_hash is not null then 'submitted'
    when status = 'failed' then 'failed'
    else coalesce(payment_status, 'created')
  end,
  verification_checks = case
    when status = 'paid' then coalesce(nullif(verification_checks, '{}'::jsonb), jsonb_build_object(
      'chain', true,
      'recipient', true,
      'amount', true,
      'token', true,
      'tx_success', true,
      'backend_verified', true
    ))
    else coalesce(verification_checks, '{}'::jsonb)
  end;
