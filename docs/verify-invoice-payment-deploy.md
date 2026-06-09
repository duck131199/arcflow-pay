# Deploy `verify-invoice-payment`

This Edge Function verifies an Arc Testnet USDC transfer before marking an invoice as `paid`.

## Required environment

- Supabase CLI installed and authenticated
- Supabase project linked
- Edge Function secrets set

## Constants

Current Arc Testnet values used by the app:

```text
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=0x4cedd2
USDC_TOKEN=0x3600000000000000000000000000000000000000
USDC_DECIMALS=6
```

## Deploy steps

From the repo root:

```bash
supabase link --project-ref <your-project-ref>
supabase secrets set \
  ARC_RPC_URL=https://rpc.testnet.arc.network \
  ARC_CHAIN_ID=0x4cedd2 \
  USDC_TOKEN=0x3600000000000000000000000000000000000000 \
  USDC_DECIMALS=6
supabase functions deploy verify-invoice-payment
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are normally available in hosted Supabase Edge Functions. If your project does not expose them automatically, add them as secrets too.

## Smoke test

After deploy:

1. Wallet A creates a fresh invoice for wallet B, amount `1 USDC`.
2. Wallet B pays from Pay Invoice.
3. Expected success toast:

```text
Payment verified and recorded
```

4. The invoice should become `paid` and disappear from B's unpaid inbox.

## Negative tests

Try these after one successful payment:

- Reuse the same `tx_hash` for another invoice: should reject.
- Use a failed transaction hash: should reject.
- Pay less than invoice amount: should reject.
- Pay the wrong recipient wallet: should reject.
- Pay after expiry: should reject.

## Notes

The function checks:

- RPC chain id is Arc Testnet
- invoice exists
- invoice status is `unpaid` or `pending`
- invoice has not expired
- tx hash has not already been used
- receipt status is success
- receipt contains USDC `Transfer` to seller wallet
- transferred amount is at least invoice amount
