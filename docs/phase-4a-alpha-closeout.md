# Phase 4A-alpha Closeout

Status: production smoke passed; pending Duck approval for final checkpoint/tag.

Date: 2026-06-29.

## Scope

Phase 4A-alpha closes the public-wallet Convert to USDC alpha for Arqis on Arc Testnet.

This milestone is production-testable, not mainnet-ready. It is enough to demo, test with real Arc Testnet wallets, explain current scope, collect feedback, and move into the next phase with known limits documented.

## Release notes

Included in this alpha:

- Public payer wallet conversion flow for Arc Testnet assets into USDC.
- Same-chain Arc Testnet conversion path for `EURC -> USDC`.
- `cirBTC -> USDC` option gated by available quote/estimate support.
- User wallet signs the swap transaction.
- Swap success only refreshes balances; it does not mark an invoice paid.
- Payer must still click Pay Invoice after enough USDC is available.
- Invoice payment still relies on the separate payment flow and backend verification path.
- Browser App Kit calls are routed through `/api/circle-stablecoin-kits`.
- Static deploy includes the public Circle Kit runtime config needed by the browser bundle.

Not included in this alpha:

- Mainnet payments.
- Cross-chain swaps, CCTP, or bridge routing.
- Server-custodied user swaps.
- Auto-pay immediately after swap.
- Full public beta hardening.
- Production-grade monitoring, alerting, or support operations.

## Tester requirements

Before testing:

- Use Arc Testnet only.
- Use a wallet that supports the Arqis app flow, such as MetaMask, Rabby, or a wallet browser.
- Add Arc Testnet to the wallet.
- Hold enough test USDC for network/provider fees before confirming a swap.
- Recommended fee buffer: about `0.1-0.2 USDC` on Arc Testnet.
- Hold test EURC or cirBTC if testing Convert to USDC.
- Do not send mainnet assets.

## Production smoke checklist

Run against the production URL before marking Phase 4A-alpha complete.

Read-only production smoke on 2026-06-29 passed for core routes, docs links, public config, swap asset loading, and proxy bad-path handling. No hardcoded private secret was found; keyword matches were limited to safety comments.

Real-wallet production smoke on 2026-06-29 passed with Duck:

- Wallet reconnect could restore an already-authorized address, but sensitive actions still required wallet unlock/confirm/sign.
- Direct USDC invoice payment passed for invoice `AF-20260629-N4PMBC`: seller `@luekare` / `0xb1f9...446e`, payer `@tee_crypt` / `0xa031...748a`, amount `1.00 USDC`.
- Receipt showed `PAID`, payment status `Completed`, backend verification completed, tx hash recorded as `0xf15c...c4da`, and Seller Console showed `Invoice payment from @tee_crypt +1 USDC`.
- Duck reported both Convert to USDC token branches passed in production wallet testing. No extra tx hashes were captured in this closeout.

### App shell

- Production URL opens.
- `assets/arqis-config.js` loads.
- `assets/arqis-swap.js` loads.
- No missing critical static assets.
- Browser console has no blocking app errors.

### Wallet setup

- Connect wallet opens the expected wallet provider.
- Wallet address appears after connection.
- Switch to Arc Testnet works or gives clear user-facing guidance.
- Wallet setup page still warns that testnet assets have no real value.

### Create invoice

- Seller can enter payer Arqis name, amount, memo/order ID, and expiry.
- Invoice preview updates correctly.
- Send invoice does not produce a visible Supabase constraint error.
- Created invoice appears in the seller-created list when the wallet/session is valid.

### Pay invoice

- Payer can open a payable invoice.
- Invoice amount, memo, recipient, network, and expiry are visible.
- If payer has enough USDC, Pay Invoice remains the direct path.
- If payer has a USDC shortfall and supported source balance, Convert to USDC appears.

### Convert to USDC

- Token choice appears only for supported available test assets.
- Empty or zero amount does not leave stale quote data visible.
- Preview conversion returns a readable quote or a readable failure.
- Confirm swap opens wallet confirmation.
- Wallet cancel shows a short user-facing cancellation message.
- Fee shortfall disables confirm with clear copy.
- Successful swap refreshes balances.
- Successful swap does not mark the invoice paid.

### Seller console

- Seller console opens.
- Refresh transactions does not show old placeholder data.
- Transaction details open when activity is available.
- Arcscan links use the Arc Testnet explorer.

### Docs

- Docs landing opens.
- Create Invoice docs open.
- Pay Invoice docs open.
- Seller Console docs open.
- Circle Faucet / Setup docs open.
- Security / Verification docs open.
- Roadmap/future modules are still marked as roadmap, not active payment features.

## Demo script

1. Open Arqis production.
2. Connect seller wallet on Arc Testnet.
3. Register or use an existing Arqis name for the seller.
4. Create an invoice for the payer with an amount that makes the payer's USDC balance short.
5. Open the payer wallet/session on Arc Testnet.
6. Open Pay Invoice and select the invoice.
7. Show the invoice amount, memo, recipient, and network.
8. Open Convert to USDC.
9. Choose EURC or cirBTC when available.
10. Enter a conversion amount.
11. Preview conversion.
12. Confirm swap in the wallet.
13. After the swap finishes, show that balances refresh.
14. Show that the invoice is still not paid automatically.
15. Click Pay Invoice.
16. Confirm the payment in the wallet.
17. Show the submitted transaction state and seller console activity.
18. Open Arcscan for the relevant transaction when available.

## Known issues and backlog

- Phase 4A-alpha is Arc Testnet only.
- Payer needs a small USDC fee buffer before confirming swaps.
- Swap and invoice payment are intentionally separate steps.
- `cirBTC -> USDC` depends on quote availability.
- Cross-chain assets are not supported in this milestone.
- The app is not audited.
- Public beta still needs stronger wallet-auth binding and final RLS review.
- Monitoring, alerting, retry handling, and support runbooks are not complete.
- Failure/retry/refund handling needs fuller product documentation before public beta.
- Final checkpoint/tag still needs explicit Duck approval.

## Final checkpoint criteria

Phase 4A-alpha can be marked complete when:

- Local gates pass.
- Production smoke checklist is completed.
- Known issues above are accepted for alpha.
- Release notes and demo script are present.
- Duck approves the final checkpoint.
- Optional final tag is created only after Duck explicitly approves it.

## Final local gates

Run on 2026-06-29:

- `npm.cmd run build:swap`: passed.
- `node scripts/audit-4a-state.cjs`: passed.
- `node scripts/audit-4a-config.cjs`: passed.
- Inline script syntax check for `index.html`: passed.
- `npm.cmd test`: passed, 8 Hardhat tests.
