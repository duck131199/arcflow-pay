# Arqis Architecture

Arqis is currently a static Arc Testnet payment prototype focused on stablecoin invoice payments.

The current architecture is intentionally simple so the MVP can be tested quickly without a heavy framework or backend stack.

## High-level system

```text
Seller
  ↓
Arqis Web App
  ↓                ↘
Supabase            Wallet Provider
  ↓                  ↓
Invoice records      Arc Testnet transaction
                     ↓
                   ArcScan / future verifier
```

## Current components

### Web App

Current entry files:

```text
home.html
index.html
```

The web app currently handles:

- Arqis name registration
- invoice creation
- invoice inbox/payment flow
- installed wallet selector
- wallet QR for direct transfers
- Arc Testnet USDC payment submission
- seller console
- testnet notices and docs links

The app is still a browser-side prototype. Most UI, CSS, and JavaScript are currently inside the main HTML files.

### Supabase

Supabase stores invoice and user-facing metadata for the prototype.

Current responsibilities:

- store Arqis identities / names
- store invoice records
- store invoice expiry values
- support seller console reads
- support invoice/payment flow metadata

Current schema reference:

```text
docs/supabase-schema.sql
```

### Wallet Providers

Arqis uses external wallet providers rather than a platform-owned wallet balance.

Current direction:

- user connects an installed wallet
- payer confirms payment in their wallet
- seller settlement is direct-to-wallet
- mobile wallet behavior is preserved separately

Current supported flow is focused on Arc Testnet USDC.

### Arc Testnet

Arqis currently targets Arc Testnet for USDC invoice payment experiments.

Current status:

- testnet-only
- not production payment processing
- not audited
- no mainnet payment guarantee

### QR Code Library

Arqis uses a local QR code vendor library:

```text
assets/qrcode.js
```

This is a third-party/vendor utility used for QR generation. It is not Arqis business logic.

Future cleanup may move it to:

```text
assets/vendor/qrcode.js
```

but only after updating script references and testing QR behavior.

## Current payment flow

```text
1. Seller creates invoice
2. Invoice metadata is stored
3. Payer opens invoice/payment flow
4. Payer connects wallet
5. Payer reviews invoice details
6. Wallet submits Arc Testnet USDC transaction
7. App shows submitted/receipt state
8. Seller console tracks invoice activity
```

## Planned verification architecture

The current prototype should not treat client-side wallet submission as final production verification.

Future backend verification should check:

```text
- chain/network is correct
- token contract is correct
- recipient wallet is correct
- amount is correct
- transaction hash is valid
- transaction is confirmed
- transaction has not already been used
- invoice is not expired
```

Future flow:

```text
Payer wallet transaction
  ↓
Arc Testnet / Arc Mainnet
  ↓
Backend verifier / indexer
  ↓
Verified invoice status update
  ↓
Seller console / receipt
```

## Future modules

Future Arqis modules may include:

```text
Public Invoice Links
QR Checkout
Server-side Payment Verification
Payment Receipts
Seller Dashboard
Multi-asset Support
API + Webhooks
Mainnet Readiness
```

These are roadmap items unless explicitly implemented and tested.

## Design principles

Arqis should remain:

- simple enough for individuals and small businesses
- clear about invoice details
- direct about wallet/payment ownership
- honest about testnet limitations
- careful with production/security claims
- structured enough for future technical growth

## Non-goals for current MVP

The current MVP does not claim:

- production payment processor readiness
- audited security
- server-side payment verification
- fiat rails
- custody or platform balance
- guaranteed low fees
- mainnet settlement

## Core files to protect

Changes to these files should be small and tested carefully:

```text
home.html
index.html
assets/qrcode.js
```

Important current flows:

```text
Create Invoice
Pay Invoice
Seller Console
Wallet Selector
Mobile Wallet Flow
QR Generation
Supabase Reads/Writes
```
