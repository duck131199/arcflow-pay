-- Prevent duplicate Telegram payment alerts when frontend/backend verification runs concurrently.
-- Only one in-flight/sent delivery may exist for each invoice + alert type + tx hash.

create unique index if not exists telegram_alert_deliveries_payment_idempotency_idx
  on public.telegram_alert_deliveries (invoice_id, alert_type, tx_hash)
  where tx_hash is not null and status in ('sending', 'sent');
