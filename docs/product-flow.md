# Product Flow

Arqis is designed around a simple seller-to-payer payment flow.

## 1. Seller Creates an Invoice

The seller enters only the essential invoice details:

- Payment amount in USDC
- Payment memo or order ID
- Link expiry

Arqis then creates an invoice record for the payer. In the current prototype, the invoice appears in the payer’s Arqis invoice inbox after wallet connection.

Planned checkout additions include:

- Reference code

## 2. Payer Opens the Invoice

The payer opens the invoice from the Arqis invoice inbox.

The payer sees:

- Invoice memo/order name
- Amount due
- Available payment assets/sources
- Payment preview
- Confirmation action

## 3. Payer Pays with USDC on Arc Testnet

In the current MVP, the payer pays with USDC on Arc Testnet.

Multi-chain balances, Unified Balance, cross-chain routing, bridge/swap, and automated asset selection are future roadmap items. Arqis should never automatically spend, swap, bridge, or route funds without explicit user confirmation.

## 4. Payment Settles on Arc

After wallet/network confirmation, the prototype records the submitted Arc Testnet transaction for the invoice.

In the current prototype, the core checkout is designed around USDC on Arc Testnet. Production-grade server-side payment verification, routing/bridging where applicable, transaction monitoring, and final settlement indexing are future additions.

## 5. Seller Tracks Payment

The seller opens Seller Console to review invoice payments and transaction details.

Seller Console answers:

- Who paid?
- How much was paid?
- What is the status?
- What is the reference code?
- What transaction hash can be inspected on Arcscan?
- Where can the transaction be viewed on Arcscan?

