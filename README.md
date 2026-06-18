# Arqis Prototype

Arqis is a seller-first stablecoin invoice payment prototype built around Arc.

**Positioning:** stablecoin-native invoice payments, quote-ready for Arc liquidity.

Arqis is built for Arc's stablecoin-native ecosystem, where deep onchain liquidity can make B2B payments more flexible. As Arc brings leading swap infrastructure like Uniswap into the ecosystem, invoices can evolve from static payment requests into quote-ready settlement flows.

The current prototype focuses on validating a clear USDC invoice flow on Arc Testnet first. Future versions can add liquidity-aware quote previews, multi-asset payer routing, production APIs, and automated settlement operations.

## MVP

The current prototype focuses on four sections:

1. **Create Invoice** — seller creates a simple invoice for another registered Arqis testnet user.
2. **Pay Invoice** — payer chooses an available Arc Testnet asset/source and submits a testnet payment.
3. **Seller Console** — seller reviews invoice payments and transaction details.
4. **Circle Faucet / Setup** — testnet helper for getting Arc Testnet USDC.

## Why Arc

Arc is purpose-built for stablecoin-native applications. That makes Arqis a natural fit for invoice payments where sellers want predictable settlement and payers may eventually want more flexible funding options.

Arqis should not try to become a swap engine. Instead, it can focus on the invoice, checkout, receipt, and settlement UX while staying ready to use Arc ecosystem liquidity as infrastructure becomes available.

## Product Direction

Arqis starts with a simple invoice lifecycle:

```text
Seller creates an invoice
Invoice appears in the payer inbox
Payer reviews and pays the invoice
Payment settles on Arc
Seller tracks status and receipt in Seller Console
```

Next product direction:

- **Quote-ready invoices** — show a settlement preview before payment.
- **Liquidity-aware checkout** — payer can understand what they pay and what the seller receives.
- **Clean seller settlement** — seller receives the preferred settlement asset, starting with USDC.
- **Route transparency** — future swap/route details should be visible to the payer before confirmation.

## Open Locally

```text
index.html
```

Or serve the folder with a local static server and open:

```text
http://127.0.0.1:8787/index.html
```

## Docs

- [Overview](docs/overview.md)
- [Product Flow](docs/product-flow.md)
- [MVP Sections](docs/mvp-sections.md)
- [Arc Testnet Setup](docs/arc-testnet-setup.md)
- [Arc Testnet Registry](docs/arc-testnet-registry.html)
- [Future Roadmap](docs/future-roadmap.md)

## Arc Testnet Contract Proof

Arqis has an app-owned Arc Testnet contract for provenance and lightweight invoice/payment-reference proof.

```text
Contract: ArqisInvoiceRegistry
Address: 0xd04532EBb554ef00A166355a9c1145Ad53B85780
Network: Arc Testnet
Chain ID: 5042002
Deployer / project owner: 0xB1f9eE64333564050964241688899166307d446e
Deployment tx: 0xb69585b7ea314ed13206b1cf75265126a69221561af225c1a4a9309c407ccecd
Example createInvoice tx: 0x3a46fac6c204ee75fac379c9e9569eddfa8f7ff8e48b979fe52818c7f35366d0
```

This contract is not a custody contract, swap engine, bridge, or replacement for USDC/CCTP infrastructure. It records app-specific Arqis invoice proof events and payment transaction references for the testnet MVP. Full production payment verification is planned separately.

## Status

This is a testnet prototype. Some docs/screens may use placeholder examples for product review; live wallet balances and transaction rows depend on the connected wallet, Arc Testnet, Arcscan, and Supabase availability. Do not treat the current client-side MVP as production payment verification.

Quote-ready and liquidity-aware flows are product direction notes, not claims that the current MVP performs live swaps or automated routing.
