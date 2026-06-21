-- Allow in-flight Telegram delivery claims for idempotent payment alerts.

alter table public.telegram_alert_deliveries
  drop constraint if exists telegram_alert_deliveries_status_check;

alter table public.telegram_alert_deliveries
  add constraint telegram_alert_deliveries_status_check
  check (status = any (array['sending'::text, 'sent'::text, 'skipped'::text, 'failed'::text]));
