# Arc/Circle Swap Kit Integration Notes

Purpose: future planning notes for adding token swap support to Arqis without touching current production flow yet.

_Last researched: 2026-06-11_

## What Swap Kit is

Arc/Circle App Kit includes a **Swap** capability. It lets an app swap one supported token into another, for example:

- USDC -> EURC
- EURC -> USDC
- USDC/EURC/cirBTC on Arc Testnet

This means Arqis would not need to build an AMM/router/smart-contract swap layer from scratch. We can call Circle/Arc SDK methods and let the kit handle quote/execution details.

Docs checked:

- https://docs.arc.io/app-kit/swap
- https://docs.arc.io/app-kit/quickstarts/swap-tokens-same-chain
- https://docs.arc.io/app-kit/quickstarts/swap-tokens-crosschain

## Why it matters for Arqis

Current Arqis invoices are USDC-only. A future Swap Kit feature could support:

> Payer has EURC/cirBTC, invoice requires USDC, seller receives USDC.

Possible UX:

1. Invoice says `10 USDC`.
2. Payer wallet has EURC but not enough USDC.
3. Arqis shows: `Swap EURC -> USDC then pay invoice`.
4. Payer reviews estimated output, provider fee, gas fee, and slippage/stop limit.
5. Swap executes.
6. Invoice payment executes in USDC.
7. Invoice becomes Paid only after payment tx is confirmed.

## Package options

Full App Kit:

```bash
npm install @circle-fin/app-kit @circle-fin/adapter-viem-v2 viem
```

Standalone/light swap kit option:

```bash
npm install @circle-fin/swap-kit @circle-fin/adapter-viem-v2 viem
```

Other adapters exist:

- Viem
- Ethers
- Solana
- Circle Wallets

For Arqis browser wallet flow, likely investigate a Viem/Ethers browser-wallet adapter first. Avoid server-side private key flows for user wallets.

## Required credentials / config

Docs mention a free `KIT_KEY` from Circle Console.

Server-side examples also use credentials like:

- `CIRCLE_API_KEY`
- `CIRCLE_ENTITY_SECRET`
- `KIT_KEY`

Important: never expose private keys or sensitive Circle secrets in frontend code. If a future implementation needs server-side credentials, it should be behind an API route/server function.

## Basic same-chain swap shape

Docs show an App Kit call like:

```ts
const result = await kit.swap({
  from: { adapter: viemAdapter, chain: "Arc_Testnet" },
  tokenIn: "USDC",
  tokenOut: "EURC",
  amountIn: "1.00",
  config: {
    kitKey: process.env.KIT_KEY as string,
  },
});
```

Estimate first:

```ts
const estimate = await kit.estimateSwap(params);
```

Expected output includes fields like:

- `tokenIn`
- `tokenOut`
- `amountIn`
- `amountOut`
- `txHash`
- `explorerUrl`
- `fees`
- `estimatedOutput`
- `stopLimit`

## Cross-chain option

Docs also show swap + bridge:

1. Swap EURC -> USDC on Arc Testnet.
2. Bridge USDC to Ethereum Sepolia.

For Arqis near-term, same-chain Arc Testnet swap is more relevant than cross-chain bridge. Cross-chain should be a later feature only after invoice payment reliability is solid.

## Suggested future Arqis architecture

Do not mix Swap Kit directly into the current single-file UI at first. Add a small abstraction layer when the app is ready to modularize.

Suggested future files:

```text
src/services/arcSwapService.ts
src/services/invoicePaymentService.ts
src/ui/swapPaymentPreview.ts
```

Potential service API:

```ts
type SwapQuoteInput = {
  fromToken: "USDC" | "EURC" | "cirBTC";
  toToken: "USDC";
  amountOutNeeded?: string; // invoice amount, if exact-output supported later
  amountIn?: string;        // input amount, for estimate-first flows
  chain: "Arc_Testnet";
  payerAddress: string;
};

async function estimateInvoiceSwap(input: SwapQuoteInput) {
  // call kit.estimateSwap()
}

async function executeInvoiceSwap(input: SwapQuoteInput) {
  // call kit.swap()
}
```

## Product rules for invoice payment

Recommended for Arqis:

- Seller invoice currency remains USDC for MVP.
- Seller receives USDC.
- Swap is optional payer-side helper.
- The invoice should not become Paid after swap alone.
- Invoice becomes Paid only after the actual invoice payment tx to seller confirms.
- If swap succeeds but payment fails, show a clear retry path: payer now has USDC and can retry payment.
- If swap fails, invoice remains Payable until expired.
- If invoice expires during swap/payment, block the payment step and ask seller for a new invoice.

## UX notes

Before executing a swap, show:

- From token
- To token
- Invoice amount required
- Estimated output
- Provider fee
- Gas fee
- Slippage/stop limit
- Explorer link after tx

Possible labels:

- `Pay with EURC`
- `Swap to USDC and pay`
- `Estimated USDC after swap`
- `Swap completed, continue payment`

## Implementation caution

Do not start this until these are solid:

1. Invoice create/list/expiry behavior.
2. Payment confirmation reliably marks Paid on both Created and Pay Invoice views.
3. Refresh/reconcile correctly handles submitted tx hashes.
4. We have a clean place to keep a `KIT_KEY` without exposing secrets incorrectly.

## Near-term recommendation

Keep Arqis USDC-only until payment confirmation/Paid reliability is fully tested. Then add a spike branch for same-chain Arc Testnet swap:

1. Create a small standalone prototype using Arc docs.
2. Test USDC -> EURC and EURC -> USDC with testnet funds.
3. Decide whether browser-wallet integration works cleanly or needs a backend adapter.
4. Only then connect it to invoice payment UX.
