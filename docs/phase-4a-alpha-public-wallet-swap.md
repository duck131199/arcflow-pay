# Phase 4A-alpha — Public wallet Convert to USDC

Status: scaffolded in static Arqis app.

## Goal

Let payer wallet B use their own connected EVM wallet to convert supported Arc Testnet assets to USDC, then pay an invoice separately.

Example:

1. Wallet A creates invoice for 40 USDC.
2. Wallet B opens invoice.
3. If wallet B has enough Arc USDC, B pays directly.
4. If wallet B lacks USDC but has EURC/cirBTC on Arc Testnet, B can convert to USDC.
5. Swap success does not mark invoice paid.
6. B clicks Pay Invoice after USDC balance refreshes.
7. Backend verifies payment tx before invoice is paid.

## Architecture

Static app path, adapted from Arc Starter Kit:

- `src/arqis-swap-browser.js` imports `@circle-fin/app-kit` and `@circle-fin/adapter-viem-v2`.
- `npm run build:swap` bundles to `assets/arqis-swap.js` with esbuild.
- `assets/arqis-config.js` provides browser/public `window.ARQIS_CONFIG.CIRCLE_KIT_KEY` locally/deployment-side.
- `index.html` loads `assets/arqis-config.js` and `assets/arqis-swap.js`.
- Existing connected wallet provider (`activeEthereum()`) is passed into App Kit via `createViemAdapterFromProvider()`.

No server private key is used for public user swaps.

## Current alpha scope

Supported:

- Arc Testnet same-chain conversion only.
- `EURC -> USDC`.
- `cirBTC -> USDC` route-gated by estimate.
- User wallet signs swap transaction.

Not supported in 4A-alpha:

- Cross-chain assets.
- CCTP/Gateway bridging.
- Server-custodied user swaps.
- Auto-pay after swap.

## Files

- `src/arqis-swap-browser.js`
- `assets/arqis-swap.js`
- `assets/arqis-config.example.js`
- `assets/arqis-config.js` (ignored by git)
- `index.html`

## Commands

```bash
npm run build:swap
```

## Config

`assets/arqis-config.js` must contain a public Circle Kit Key:

```js
window.ARQIS_CONFIG = {
  CIRCLE_KIT_KEY: "replace_with_public_circle_kit_key",
  SWAP_SLIPPAGE_BPS: 300,
  CIRCLE_PROXY_URL: "/api/circle-stablecoin-kits",
};
```

Do not put private keys, Circle API keys, deployer keys, or Circle entity secrets in this file.

Deploy notes:

- `assets/arqis-config.js` is committed for the current static Vercel deploy so production always has the public Circle Kit Key.
- `assets/arqis-config.example.js` remains the template for other environments.
- Production build can also regenerate `assets/arqis-config.js` from `ARQIS_CIRCLE_KIT_KEY` or `CIRCLE_KIT_KEY` via `scripts/write-arqis-config.cjs`.
- `index.html` must load `assets/arqis-config.js` before `assets/arqis-swap.js`.
- `api/circle-stablecoin-kits.js` must be deployed with the static app so Circle App Kit browser requests can be proxied.
- `assets/arqis-swap.js` should be committed for the current static deploy path unless the deploy pipeline runs `npm.cmd run build:swap` / `npm run build:swap` before publishing.
- `.env.example` contains local contract/spike variables only. Do not copy server/private env values into browser config.

## UI behavior

When an invoice is payable and native Arc USDC is short:

- Show Convert to USDC card.
- Show current USDC balance, invoice amount, and shortfall.
- Let user choose EURC/cirBTC if wallet has balance.
- User enters amount to convert.
- Preview calls `estimateSwapToUsdc()`.
- Confirm calls `swapToUsdc()` and opens wallet confirmation.
- After swap returns, Arqis refreshes balances.
- If USDC is now enough, Pay Invoice button becomes available.

## 5.1 code audit notes

Audit date: 2026-06-26.

Manual/state audit outcomes:

- Leaving Pay Invoice resets swap state, closes the swap modal, clears quote timers, and invalidates old quote responses.
- Selecting a different invoice in the inbox resets swap state before rendering the newly selected invoice.
- Changing the swap amount clears the previous estimate and disables wallet confirm until a fresh quote returns.
- While a quote is refreshing, stale estimates are hidden and `Confirm swap in wallet` remains disabled.
- While wallet confirmation is pending, amount input, token choice, refresh quote, and confirm controls are locked.
- Wallet reject/failure unlocks swap state in `finally`.
- Paid/expired invoice copy does not suggest converting or paying again.
- Swap success never marks an invoice paid; it only refreshes balances. Payer must click Pay Invoice separately.

Automated gates run:

```bash
npm.cmd run build:swap
node scripts/audit-4a-state.cjs
node -e "const fs=require('fs'); const html=fs.readFileSync('index.html','utf8'); const scripts=[...html.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)].map(m=>m[1]); scripts.forEach((s)=>new Function(s)); console.log('ok inline scripts',scripts.length)"
```

Results:

- `build:swap`: passed, generated `assets/arqis-swap.js` (~3.5 MB).
- `audit-4a-state.cjs`: passed all state guards.
- Inline script syntax check: passed.
- Secret scan of frontend/proxy files found no private key/API secret hardcoded; only the expected warning comment in `assets/arqis-config.example.js`.

Proxy/wrapper audit:

- `src/arqis-swap-browser.js` exposes only `estimateSwapToUsdc`, `swapToUsdc`, and `getSwapStatus` on `window.ArqisSwap`.
- Circle browser fetch rewrite only targets `https://api.circle.com/v1/stablecoinKits/`.
- `api/circle-stablecoin-kits.js` only proxies paths starting with `/v1/stablecoinKits/`.
- No server private key is required for public-wallet swaps.

## 5.3/5.4 happy-path and failure-path notes

Audit date: 2026-06-26.

Local happy-path gates:

- Static route smoke test passed for `/`, `/create-invoice`, `/pay-invoice`, `/seller-console`, and `/wallet-setup` after updating `scripts/dev-server.mjs` route rewrites.
- Static assets load: `assets/arqis-swap.js` and `assets/arqis-config.js` returned 200 locally.
- Proxy bad-path smoke test returned 400 for unsupported non-stablecoinKits path, as expected.

Wallet/user-tested happy path:

- Payer can open a payable invoice with a USDC shortfall.
- Payer can quote `EURC -> USDC` from the Convert to USDC modal.
- UI distinguishes under-swap (`Remaining after swap`) from enough/dust-over swap (`Ready to pay` / `Enough USDC`).
- Swap remains separate from invoice payment. UI still requires Pay Invoice after USDC arrives.

Failure paths covered and fixed:

- Wallet cancel/reject initially surfaced a long technical viem/provider error in the toast. It now shows the short user-facing message `Swap cancelled in wallet`.
- Wallet/network fee shortfall initially appeared only inside the wallet. Quote UI now detects estimated USDC fees and disables confirm with `Need USDC for network fee` / `Need fee USDC` when current USDC cannot cover fees.
- Clearing the amount to empty/zero initially left stale receive/fee/after-swap values visible. Amount empty/zero now clears the quote UI and disables confirm.
- Changing invoice or leaving Pay Invoice resets swap state and quote timers so old invoice quotes do not carry over.
- While quotes refresh, stale estimates are hidden and confirm stays disabled.

Remaining expected tester requirement:

- Wallet must hold a small Arc USDC balance for network/provider fees before a swap can be confirmed, even if the swap output would make the invoice payable. For testing, keep about `0.1–0.2 USDC` on Arc Testnet.

## Verified prior route evidence

Server-side route proof on 2026-06-25:

- `EURC -> USDC` estimate succeeded and tiny swap succeeded.
- Swap tx: `0xa72b3bbcf4c45cd8f76dbe10d3a6e9ea9f78125305ad464ab73970f2208991e3`.
- Explorer: https://testnet.arcscan.app/tx/0xa72b3bbcf4c45cd8f76dbe10d3a6e9ea9f78125305ad464ab73970f2208991e3
