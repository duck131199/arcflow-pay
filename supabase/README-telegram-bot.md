# Telegram bot notifications

Minimal production draft for user-owned Telegram bots.

## What this does

Setup flow:

1. User creates a bot in `@BotFather`.
2. User pastes the BotFather token into Arqis.
3. `connect-telegram-bot` validates the token with Telegram `getMe` and stores it encrypted server-side.
4. User opens the bot and sends `/start`.
5. `send-telegram-test-alert` captures the chat and sends a real test alert.

Invoice/payment alert flow mirrors the local test backend:

1. When A creates an invoice for B, the frontend best-effort calls `telegram-invoice-alert` with `invoice_id`.
2. `telegram-invoice-alert` sends two deduped alerts when bots are connected/tested:
   - A gets `🧾 Invoice sent`.
   - B gets `📩 New invoice to pay`.
3. When B pays, `verify-invoice-payment` marks the invoice paid only after on-chain verification, then best-effort calls `telegram-payment-alert`.
4. `telegram-payment-alert` sends two deduped alerts when bots are connected/tested:
   - B gets `✅ Invoice paid` / receipt.
   - A gets `💸 Payment received`.

Frontend never stores or sends chat IDs for invoice/payment alerts. Frontend never stores BotFather tokens after connect.

## Required SQL

Run:

```text
docs/supabase-schema.sql
supabase/telegram-bot-schema.sql
```

## Required Edge Function secrets

```text
SUPABASE_URL=<project url>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
TELEGRAM_TOKEN_ENCRYPTION_KEY=<random 32+ char secret>
```

Do not put seller bot tokens in frontend code, localStorage, GitHub, or public docs.

## Functions to deploy

```text
connect-telegram-bot
telegram-bot-status
send-telegram-test-alert
disconnect-telegram-bot
telegram-invoice-alert
telegram-payment-alert
verify-invoice-payment
```

## Known limitation before production-hard launch

Current draft still trusts wallet address from the frontend for connect/disconnect. Add wallet signature auth before broader public production use.
