-- Arqis public testnet hardening draft
-- Review before running in Supabase SQL Editor.
-- Goal: reduce broad-public testnet abuse without pretending this is production-grade verification.

-- 1) Keep RLS enabled.
alter table public.arcflow_users enable row level security;
alter table public.arcflow_invoices enable row level security;

-- 2) Add/keep data integrity constraints.
alter table public.arcflow_invoices
  drop constraint if exists arcflow_invoices_status_check;

alter table public.arcflow_invoices
  add constraint arcflow_invoices_status_check
  check (status in ('unpaid', 'pending', 'paid', 'failed', 'expired', 'cancelled'));

alter table public.arcflow_invoices
  drop constraint if exists arcflow_invoices_memo_length_check;

alter table public.arcflow_invoices
  add constraint arcflow_invoices_memo_length_check
  check (char_length(memo) between 1 and 99);

alter table public.arcflow_invoices
  drop constraint if exists arcflow_invoices_amount_public_testnet_check;

alter table public.arcflow_invoices
  add constraint arcflow_invoices_amount_public_testnet_check
  check (amount >= 1 and amount <= 50000);

alter table public.arcflow_invoices
  drop constraint if exists arcflow_invoices_tx_hash_format_check;

alter table public.arcflow_invoices
  add constraint arcflow_invoices_tx_hash_format_check
  check (tx_hash is null or tx_hash ~ '^0x[0-9a-fA-F]{64}$');

create unique index if not exists arcflow_invoices_tx_hash_unique
  on public.arcflow_invoices(tx_hash)
  where tx_hash is not null;

-- 3) Replace wide-open prototype policies with narrower static-MVP policies.
-- IMPORTANT LIMITATION:
-- Without wallet-signature auth or Supabase authenticated users, Postgres RLS cannot know
-- which browser wallet signed the request. These policies still allow broad testnet usage,
-- but remove arbitrary client-side payment status updates.

drop policy if exists "arcflow users readable" on public.arcflow_users;
drop policy if exists "arcflow users insertable" on public.arcflow_users;
drop policy if exists "arcflow users update own wallet" on public.arcflow_users;

create policy "arcflow users public lookup"
  on public.arcflow_users for select
  using (true);

create policy "arcflow users public register once"
  on public.arcflow_users for insert
  with check (
    username ~ '^[a-z0-9_]{3,24}$'
    and wallet_address ~ '^0x[0-9a-fA-F]{40}$'
    and char_length(display_name) between 1 and 32
  );

-- No public update/delete policy for users in broad testnet mode.
-- Name changes / moderation should be done by service role/admin tooling later.

drop policy if exists "arcflow invoices readable" on public.arcflow_invoices;
drop policy if exists "arcflow invoices insertable" on public.arcflow_invoices;
drop policy if exists "arcflow invoices updateable" on public.arcflow_invoices;

create policy "arcflow invoices public read testnet"
  on public.arcflow_invoices for select
  using (true);

create policy "arcflow invoices public create unpaid"
  on public.arcflow_invoices for insert
  with check (
    status = 'unpaid'
    and token = 'USDC'
    and amount >= 1
    and amount <= 50000
    and char_length(memo) between 1 and 99
    and tx_hash is null
    and paid_at is null
    and expires_at > now()
  );

-- No public invoice update policy.
-- Next technical step: add a Supabase Edge Function / trusted backend with service-role access
-- to verify tx_hash on Arc Testnet and update status to pending/paid/failed.

-- Optional cleanup helper for expired unpaid invoices. Run manually or from a scheduled function.
create or replace function public.arcflow_expire_old_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  update public.arcflow_invoices
  set status = 'expired'
  where status in ('unpaid', 'pending')
    and expires_at < now();
  get diagnostics changed = row_count;
  return changed;
end;
$$;
