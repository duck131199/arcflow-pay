# Arqis Telegram Bot Deploy Checklist

Production-oriented checklist for the user-owned Telegram bot notification flow.

## Scope

Covers:

- `seller_telegram_bots` encrypted bot-token storage
- `telegram_alert_deliveries` delivery log/dedupe
- Supabase Edge Functions for connect/status/test/invoice/payment alerts
- Frontend setup UI in `index.html`

## Required Supabase secrets

Set these before deploying functions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_TOKEN_ENCRYPTION_KEY`

`TELEGRAM_TOKEN_ENCRYPTION_KEY` must be long, random, and stable. Rotating it without re-encrypting stored bot tokens will break existing bots.

## Database migration

Run or verify:

```sql
supabase/telegram-bot-schema.sql
```

Expected tables:

- `public.seller_telegram_bots`
- `public.telegram_alert_deliveries`

Expected security posture:

- RLS enabled on both tables.
- No anon read/insert/update policies for bot-token storage.
- Frontend never reads `bot_token_cipher`.
- Service-role access is limited to Edge Functions.

## Edge Functions to deploy

Deploy/redeploy these together when changing Telegram behavior:

- `connect-telegram-bot`
- `disconnect-telegram-bot`
- `telegram-bot-status`
- `send-telegram-test-alert`
- `telegram-invoice-alert`
- `telegram-payment-alert`
- `verify-invoice-payment` when payment alert trigger logic changes

## Frontend deploy checks

Before deploy:

- Search tracked files for Telegram token patterns.
- Confirm `.local-telegram-state.json` is ignored and not committed.
- Confirm Telegram local test mode only activates with `?localTelegram=1`.
- Confirm bot token input is `type="password"` and cleared after connect.
- Confirm no Telegram token is written to `localStorage` or `sessionStorage`.

## Smoke test without spam

Use one wallet + one Arqis name.

1. Open production app with no `?localTelegram=1`.
2. With wallet disconnected:
   - Telegram setup is locked.
   - BotFather examples are generic.
   - No old wallet/name/bot identity is visible.
3. Connect wallet and confirm registered Arqis name appears.
4. Check Telegram setup status:
   - Existing tested bot should show `Connected and tested`.
   - Untested bot should ask user to open bot, send `/start`, then test.
5. If a real test alert is needed, send only one test alert.
6. Disconnect wallet and confirm Telegram UI resets to locked/generic state.
7. Create invoice only if needed for end-to-end alert validation.
8. If invoice/payment alert is tested, verify `telegram_alert_deliveries` has one `sent` row per alert type and no duplicate spam.

## Rollback

If frontend UI breaks:

- Revert the frontend commit and redeploy Vercel.
- Supabase tables can remain; they are not used if frontend stops calling functions.

If Edge Function breaks:

- Redeploy the previous known-good function version.
- Do not drop Telegram tables; they contain encrypted user configuration.

If encryption key is wrong/missing:

- Restore the previous `TELEGRAM_TOKEN_ENCRYPTION_KEY`.
- Do not rotate the key unless a re-encryption migration is ready.

If a bot token is exposed:

- Revoke/rotate the bot token in `@BotFather`.
- Reconnect the bot in Arqis.
- Remove local files/logs containing the old token.

## Current security blocker before broad production

The current functions validate `wallet_address` and `arqis_username` against the database, but they do not yet require a signed wallet challenge per Telegram request.

This is acceptable for a constrained testnet prototype, but broad production should add one of:

- wallet signature challenge verification in Edge Functions, or
- Supabase Auth / SIWE-style session binding, or
- another server-verified ownership session.

Until then, avoid treating wallet-address-only Telegram function calls as final production-grade authorization.
