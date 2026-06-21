-- Arqis RLS hardening transition
-- Applied after frontend moved app table reads/writes behind the arqis-app Edge Function.
-- Goal: stop anon/public direct access to users and invoices while service-role Edge Functions continue to operate.

alter table public.arcflow_users enable row level security;
alter table public.arcflow_invoices enable row level security;

drop policy if exists "arcflow users readable" on public.arcflow_users;
drop policy if exists "arcflow users insertable" on public.arcflow_users;
drop policy if exists "arcflow users update own wallet" on public.arcflow_users;

drop policy if exists "arcflow invoices readable" on public.arcflow_invoices;
drop policy if exists "arcflow invoices insertable" on public.arcflow_invoices;
drop policy if exists "arcflow invoices updateable" on public.arcflow_invoices;

create policy "arcflow users no anon read"
  on public.arcflow_users for select
  to public
  using (false);

create policy "arcflow users no anon insert"
  on public.arcflow_users for insert
  to public
  with check (false);

create policy "arcflow users no anon update"
  on public.arcflow_users for update
  to public
  using (false)
  with check (false);

create policy "arcflow invoices no anon read"
  on public.arcflow_invoices for select
  to public
  using (false);

create policy "arcflow invoices no anon insert"
  on public.arcflow_invoices for insert
  to public
  with check (false);

create policy "arcflow invoices no anon update"
  on public.arcflow_invoices for update
  to public
  using (false)
  with check (false);

revoke select, insert, update, delete, truncate on public.arcflow_users from anon, authenticated;
revoke select, insert, update, delete, truncate on public.arcflow_invoices from anon, authenticated;
