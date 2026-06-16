# Arqis

Arqis is a seller-first stablecoin invoice payment prototype built around Arc.

Current MVP: validate the USDC invoice flow on Arc Testnet before adding liquidity-aware quote previews, multi-asset routing, webhooks, production APIs, or automated payment operations.

Arqis is designed around a simple thesis: invoice payments should become more programmable as Arc's stablecoin-native ecosystem gains deeper onchain liquidity. The product should focus on the invoice, checkout, receipt, and seller settlement experience while staying ready for infrastructure such as Uniswap protocol/API as it becomes available on Arc.

The current MVP focuses on a simple payment flow for individuals, freelancers, and small businesses:

```text
Seller creates an invoice
→ Invoice appears in payer inbox
→ Payer opens the invoice
→ Payer chooses which asset/source to pay with
→ Payment settles on Arc
→ Seller tracks the payment in Seller Console
```

This prototype intentionally starts small. It is not trying to become a full payment infrastructure product on day one. The first goal is to make invoice payments clear, useful, and easy to test.

Near-term positioning: **stablecoin-native invoice payments, quote-ready for Arc liquidity.**

## MVP Sections

1. **Create Invoice**  
   A seller creates a simple USDC invoice record for the payer. In this prototype, it appears in the payer’s Arqis invoice inbox after wallet connection.

2. **Pay Invoice**  
   A payer opens the invoice, reviews available wallet assets, chooses how to pay, and confirms the payment.

3. **Seller Console**  
   A seller reviews many invoice payments and opens each one for transaction details.

4. **Circle Faucet / Setup**  
   A testnet helper for team members who need Arc Testnet USDC.

## Current Status

Arqis is currently an Arc Testnet prototype. Placeholder examples are used before wallet data is loaded. After wallet connection, Arqis fetches real Arc Testnet wallet activity where available.

Future versions can add real wallet connection, Arc RPC reads, backend invoice generation, transaction indexing, quote previews, liquidity-aware routing, and production settlement logic.

Quote-ready and liquidity-aware flows are product direction notes, not claims that the current MVP performs live swaps or automated routing.
