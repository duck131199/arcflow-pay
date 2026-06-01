# Product Flow

ArcFlow Pay is designed around a simple seller-to-payer payment flow.

## 1. Seller Creates an Invoice

The seller enters only the essential invoice details:

- Payment amount in USDC
- Payment memo or order ID
- Link expiry

ArcFlow then generates:

- Reference code
- Payment link
- QR code

The seller can send the payment link or QR code to the payer.

## 2. Payer Opens the Invoice

The payer opens the payment link or scans the QR code.

The payer sees:

- Invoice memo/order name
- Amount due
- Available payment assets/sources
- Payment preview
- Confirmation action

## 3. Payer Chooses How to Pay

The payer controls asset selection.

ArcFlow should not automatically spend, swap, bridge, or route funds without explicit user confirmation.

The payer can choose a source such as:

- Arc USDC
- Base USDC
- Arbitrum USDC
- Solana USDC
- Unified Balance

## 4. Payment Settles on Arc

After confirmation, payment settlement is represented as USDC settlement on Arc.

In the current prototype, settlement is mocked. In a production version, this step would require wallet transactions, routing/bridging logic where applicable, transaction monitoring, and final settlement indexing.

## 5. Seller Tracks Payment

The seller opens Seller Console to review invoice payments and transaction details.

Seller Console answers:

- Who paid?
- How much was paid?
- What is the status?
- What is the reference code?
- What transaction hash proves payment?
- Where can the transaction be viewed on Arcscan?
