-- Add Telegram delivery types for expired invoice alerts.

alter table if exists public.telegram_alert_deliveries drop constraint if exists telegram_alert_deliveries_alert_type_check;
alter table if exists public.telegram_alert_deliveries add constraint telegram_alert_deliveries_alert_type_check
  check (alert_type in (
    'invoice_sent',
    'invoice_received',
    'payer_receipt',
    'payment_received',
    'invoice_expired_seller',
    'invoice_expired_payer',
    'test',
    'invoice_created'
  )) not valid;
alter table if exists public.telegram_alert_deliveries validate constraint telegram_alert_deliveries_alert_type_check;
