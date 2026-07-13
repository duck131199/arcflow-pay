-- Schedule expired invoice Telegram alerts every 5 minutes.
-- Requires pg_cron + pg_net enabled in the Supabase project.
-- Uses the public anon key only to satisfy Edge Function JWT verification; the
-- function itself uses server-side environment secrets for privileged DB writes.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('telegram-expired-invoice-alert-every-5-minutes')
where exists (
  select 1 from cron.job where jobname = 'telegram-expired-invoice-alert-every-5-minutes'
);

select cron.schedule(
  'telegram-expired-invoice-alert-every-5-minutes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://mvoisxrxysfherkxrrpt.supabase.co/functions/v1/telegram-expired-invoice-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_g7Hr_E_HePl5CcQF70RjGg__avh8bN8'
    ),
    body := '{}'::jsonb
  );
  $$
);
