-- Arqis MVP Supabase schema
-- Run this in Supabase SQL Editor after creating a project.

create extension if not exists pgcrypto;

create table if not exists public.arcflow_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text not null,
  wallet_address text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arcflow_users_username_format check (username ~ '^[a-z0-9_]{3,24}$'),
  constraint arcflow_users_wallet_format check (wallet_address ~ '^0x[0-9a-fA-F]{40}$')
);

create table if not exists public.arcflow_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  from_username text not null references public.arcflow_users(username),
  from_wallet text not null,
  to_username text not null references public.arcflow_users(username),
  to_wallet text not null,
  amount numeric(38, 6) not null check (amount > 0),
  token text not null default 'USDC',
  memo text not null,
  expiry text not null check (expiry in ('6h', '12h', '24h', '3days', '7days')),
  status text not null default 'unpaid' check (status in ('unpaid', 'pending', 'paid', 'expired', 'cancelled')),
  tx_hash text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  paid_at timestamptz
);

create index if not exists arcflow_invoices_to_status_idx on public.arcflow_invoices(to_username, status, created_at desc);
create index if not exists arcflow_invoices_from_status_idx on public.arcflow_invoices(from_username, status, created_at desc);

alter table public.arcflow_users enable row level security;
alter table public.arcflow_invoices enable row level security;

-- Prototype policies for static GitHub Pages + anon key.
-- These are intentionally simple for MVP. Tighten before production.

drop policy if exists "arcflow users readable" on public.arcflow_users;
create policy "arcflow users readable"
  on public.arcflow_users for select
  using (true);

drop policy if exists "arcflow users insertable" on public.arcflow_users;
create policy "arcflow users insertable"
  on public.arcflow_users for insert
  with check (true);

drop policy if exists "arcflow users update own wallet" on public.arcflow_users;
create policy "arcflow users update own wallet"
  on public.arcflow_users for update
  using (true)
  with check (true);

drop policy if exists "arcflow invoices readable" on public.arcflow_invoices;
create policy "arcflow invoices readable"
  on public.arcflow_invoices for select
  using (true);

drop policy if exists "arcflow invoices insertable" on public.arcflow_invoices;
create policy "arcflow invoices insertable"
  on public.arcflow_invoices for insert
  with check (true);

drop policy if exists "arcflow invoices updateable" on public.arcflow_invoices;
create policy "arcflow invoices updateable"
  on public.arcflow_invoices for update
  using (true)
  with check (true);
