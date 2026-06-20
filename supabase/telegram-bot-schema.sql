-- Arqis Telegram bot notification storage
-- Minimal production draft. Run after docs/supabase-schema.sql.

create extension if not exists pgcrypto;

create table if not exists public.seller_telegram_bots (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  arqis_username text not null references public.arcflow_users(username),
  bot_id text not null,
  bot_username text not null,
  bot_display_name text,
  bot_token_cipher text not null,
  chat_id text,
  connected_at timestamptz not null default now(),
  tested_at timestamptz,
  disconnected_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint seller_telegram_bots_wallet_format check (wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  constraint seller_telegram_bots_bot_username_format check (bot_username ~ '^[A-Za-z0-9_]{5,32}$')
);

create table if not exists public.telegram_alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.arcflow_invoices(id),
  seller_username text not null,
  recipient_username text,
  alert_type text not null check (alert_type in ('invoice_sent', 'invoice_received', 'payer_receipt', 'payment_received', 'test', 'invoice_created')),
  tx_hash text,
  telegram_bot_username text,
  telegram_chat_id text,
  status text not null default 'sent' check (status in ('sent', 'skipped', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- Upgrade-safe additions for older drafts.
alter table if exists public.telegram_alert_deliveries add column if not exists recipient_username text;
alter table if exists public.telegram_alert_deliveries add column if not exists sent_at timestamptz;

-- Older drafts used narrower alert types and a table constraint on (invoice_id, alert_type).
alter table if exists public.telegram_alert_deliveries drop constraint if exists telegram_alert_deliveries_alert_type_check;
alter table if exists public.telegram_alert_deliveries add constraint telegram_alert_deliveries_alert_type_check
  check (alert_type in ('invoice_sent', 'invoice_received', 'payer_receipt', 'payment_received', 'test', 'invoice_created')) not valid;
alter table if exists public.telegram_alert_deliveries validate constraint telegram_alert_deliveries_alert_type_check;
alter table if exists public.telegram_alert_deliveries drop constraint if exists telegram_alert_deliveries_invoice_id_alert_type_key;

-- Dedupe only successful delivery attempts. This lets a user connect/test Telegram later after an earlier skipped attempt.
create unique index if not exists telegram_alert_deliveries_sent_once
  on public.telegram_alert_deliveries(invoice_id, alert_type, (coalesce(tx_hash, '')))
  where status = 'sent' and invoice_id is not null;

alter table public.seller_telegram_bots enable row level security;
alter table public.telegram_alert_deliveries enable row level security;

-- No direct anon access: these tables include encrypted bot tokens / delivery internals.
drop policy if exists "seller telegram bots no anon read" on public.seller_telegram_bots;
create policy "seller telegram bots no anon read" on public.seller_telegram_bots for select using (false);

drop policy if exists "seller telegram bots no anon insert" on public.seller_telegram_bots;
create policy "seller telegram bots no anon insert" on public.seller_telegram_bots for insert with check (false);

drop policy if exists "seller telegram bots no anon update" on public.seller_telegram_bots;
create policy "seller telegram bots no anon update" on public.seller_telegram_bots for update using (false) with check (false);

drop policy if exists "telegram alert deliveries no anon read" on public.telegram_alert_deliveries;
create policy "telegram alert deliveries no anon read" on public.telegram_alert_deliveries for select using (false);
