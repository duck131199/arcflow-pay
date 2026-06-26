# Phase 4A.0 — Circle App Kit Swap Spike

Status: ready-to-run, blocked only by credentials/test funds.

## Question

Can Arqis use Circle App Kit Swap on Arc Testnet for a narrow server-side alpha flow:

`supported Arc Testnet asset -> USDC -> Pay Invoice separately`

without exposing `KIT_KEY` in frontend code?

## Current decision

Proceed only with a **server-side controlled spike** first.

Do not ship a browser-only user-owned wallet swap flow yet because Circle docs treat App Kit Swap as server-side and `KIT_KEY` must not be exposed client-side. No official server-prepare/client-sign or ephemeral browser-safe Kit Key pattern has been confirmed.

## Installed packages

```bash
npm install --save-dev @circle-fin/app-kit@1.8.1 @circle-fin/adapter-viem-v2@1.12.1 @circle-fin/adapter-circle-wallets@1.4.1 viem
```

## Script

```bash
node scripts/arc-app-kit-swap-spike.mjs
```

Default mode runs `estimateSwap()` only for:

- `USDC -> EURC` sanity route
- `EURC -> USDC` main invoice route
- `cirBTC -> USDC` optional route

Execution mode requires multiple explicit confirmations:

```bash
SWAP_ROUTE=main-eurc-to-usdc \
SWAP_EXECUTE_ROUTE=main-eurc-to-usdc \
SWAP_CONFIRM_ARC_TESTNET=yes \
node scripts/arc-app-kit-swap-spike.mjs --execute --i-understand-this-executes-swap
```

The script refuses to execute unless exactly one route is selected and all confirmation flags are present.

## Environment

Server-side only. Never use `NEXT_PUBLIC_KIT_KEY`.

### Option A — server-side Viem private-key adapter

Use a test wallet only.

```env
KIT_KEY=
SWAP_ADAPTER=viem-private-key
PRIVATE_KEY=
SWAP_SLIPPAGE_BPS=300
# optional: permit | approve
SWAP_ALLOWANCE_STRATEGY=
# required only with --execute
SWAP_CONFIRM_ARC_TESTNET=
```

### Option B — Circle Wallets adapter

```env
KIT_KEY=
SWAP_ADAPTER=circle-wallets
CIRCLE_API_KEY=
CIRCLE_ENTITY_SECRET=
CIRCLE_WALLET_ADDRESS=
SWAP_SLIPPAGE_BPS=300
# optional: permit | approve
SWAP_ALLOWANCE_STRATEGY=
# required only with --execute
SWAP_CONFIRM_ARC_TESTNET=
```

## Required test funds

For the wallet used by the adapter:

- USDC on Arc Testnet for gas
- EURC on Arc Testnet for `EURC -> USDC`
- cirBTC optional for `cirBTC -> USDC`

Circle Faucet: <https://faucet.circle.com/>

## Runtime estimate result — 2026-06-25

Estimate-only probe succeeded for all three routes using `SWAP_ADAPTER=viem-private-key` with a funded Arc Testnet wallet:

- `USDC -> EURC`, `amountIn=1.00`: estimated output `0.675987 EURC`; stop limit `0.655707 EURC`; provider fee `0.0002 USDC`; gas fee `0.02666296374 USDC`.
- `EURC -> USDC`, `amountIn=1.00`: estimated output `1.691436 USDC`; stop limit `1.640693 USDC`; provider fee `0.0002 EURC`; gas fee `0.02484087627 USDC`.
- `cirBTC -> USDC`, `amountIn=0.0001`: estimated output `64.737749 USDC`; stop limit `62.795617 USDC`; provider fee `0.00000002 CIRBTC`; gas fee `0.02008080081 USDC`.

Important runtime implementation note: for `createViemAdapterFromPrivateKey()` with `addressContext: 'user-controlled'`, do **not** pass `from.address` into `SwapParams`; the SDK resolves it automatically and rejects an explicit address with `INPUT_VALIDATION_FAILED / 1098`.

## Runtime swap result — 2026-06-25

Tiny `EURC -> USDC` execution succeeded on Arc Testnet.

- Route: `EURC -> USDC`
- Amount in: `1.0 EURC`
- Amount out: `1.691497 USDC`
- Provider fee: `0.0002 EURC`
- Status: `DONE / COMPLETED`
- Tx hash: `0xa72b3bbcf4c45cd8f76dbe10d3a6e9ea9f78125305ad464ab73970f2208991e3`
- Explorer: <https://testnet.arcscan.app/tx/0xa72b3bbcf4c45cd8f76dbe10d3a6e9ea9f78125305ad464ab73970f2208991e3>
- `getSwapStatus()` returned `DONE / COMPLETED`, source and destination tx hash equal, destination token `USDC`, destination amount `1.691497`.
- Post-swap balances: `USDC 21.6774923198`, `EURC 19`, `cirBTC 0.0001`.

## Success criteria

### VALIDATED

- `estimateSwap(USDC -> EURC)` succeeds. ✅
- `estimateSwap(EURC -> USDC)` succeeds. ✅
- `estimateSwap(cirBTC -> USDC)` succeeds. ✅
- A tiny `EURC -> USDC` swap succeeds and returns `txHash`, `explorerUrl` or ArcScan-linkable tx, `progress.status`, fees, and optional `amountOut`. ✅
- `KIT_KEY` remains server-side. ✅

### PARTIAL

- Estimate succeeds but swap fails due to approval/funding/runtime behavior that can be fixed.
- `USDC -> EURC` works but `EURC -> USDC` does not; 4A-alpha invoice route remains blocked.
- `EURC -> USDC` works but `cirBTC -> USDC` does not; enable EURC only and keep cirBTC flagged off.

### INVALIDATED

- `EURC -> USDC` estimate returns no route / unsupported route on Arc Testnet.
- App Kit requires unsafe client-side Kit Key exposure for the intended user-wallet flow.

## Logged evidence

The script logs JSON for:

- preflight network/token metadata
- balances for server-side Viem private-key adapter
- estimate output
- stop limit
- fees
- route failure codes
- swap tx hash
- explorer URL
- progress status/substatus
- status polling result

## Guardrails

- Swap does not mark invoice paid.
- Pay Invoice remains a separate USDC payment step.
- Backend payment verification remains source of truth.
- Store only documented fields: token in/out, chain in/out, amount in/out if present, from/to address, tx hash, explorer URL, fees, progress, slippage/allowance config.
- Do not store quote expiry; none is documented.
- Do not claim route/provider id unless explicitly configured/returned.
- Gate each token pair by `estimateSwap()` result.
