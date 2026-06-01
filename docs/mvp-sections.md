# MVP Sections

ArcFlow Pay currently focuses on four sections.

## Create Invoice

Create Invoice is for the seller.

The seller creates a payment request with only the minimum required fields:

- Payment amount, USDC
- Payment memo / order ID
- Link expiry

After creation, ArcFlow shows:

- Payment link
- QR code
- Reference code

The seller settlement wallet should be configured once in seller settings in a future version. It should not be entered every time an invoice is created.

## Pay Invoice

Pay Invoice is for the payer.

The payer opens the invoice from a link or QR code and chooses which available asset/source to use.

The key product rule is payer control:

> ArcFlow should not automatically spend, swap, bridge, or route funds without explicit payer confirmation.

The payment screen should feel like opening a wallet, checking available balances, selecting a source, and confirming payment.

## Seller Console

Seller Console is for the seller or merchant operator.

It should first show a list of many invoice payments. A seller can click one payment to inspect transaction details.

Important detail fields:

- Payment Type
- Status
- Order name
- Rate
- Reference code
- Service fee
- Network
- From
- To
- Transaction hash
- Arcscan link

At the MVP stage, Seller Console should stay simple. It does not need advanced charts, API key management, team roles, or analytics yet.

## Circle Faucet / Setup

Circle Faucet / Setup is for testnet and team testing only.

It helps testers get Arc Testnet USDC and understand the basic network configuration.

This section should be removed or hidden from the main production payment experience.
