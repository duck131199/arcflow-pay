# Arqis

Arqis is a seller-first USDC invoice payment prototype built around Arc.

Current MVP: validate the USDC invoice flow on Arc Testnet before adding multi-asset routing, webhooks, production APIs, or automated payment operations.

The current MVP focuses on a simple payment flow for individuals, freelancers, and small businesses:

```text
Seller creates an invoice
→ Invoice appears in payer inbox; shareable link/QR planned
→ Payer opens the invoice
→ Payer chooses which asset/source to pay with
→ Payment settles on Arc
→ Seller tracks the payment in Seller Console
```

This prototype intentionally starts small. It is not trying to become a full payment infrastructure product on day one. The first goal is to make invoice payments clear, useful, and easy to test.

## MVP Sections

1. **Create Invoice**  
   A seller creates a simple USDC invoice record for the payer. In this prototype, it appears in the payer’s Arqis invoice inbox after wallet connection; shareable payment links and invoice QR codes are planned for checkout.

2. **Pay Invoice**  
   A payer opens the invoice, reviews available wallet assets, chooses how to pay, and confirms the payment.

3. **Seller Console**  
   A seller reviews many invoice payments and opens each one for transaction details.

4. **Circle Faucet / Setup**  
   A testnet helper for team members who need Arc Testnet USDC.

## Current Status

Arqis is currently a testnet prototype with demo data. Wallet balances, transaction hashes, addresses, and invoice history are mocked for product review.

Future versions can add real wallet connection, Arc RPC reads, backend invoice generation, transaction indexing, and production settlement logic.
