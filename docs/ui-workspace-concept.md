# Arqis UI Workspace Concept

This document describes a future UI direction for Arqis without changing the current app.

The goal is to make Arqis feel more structured, technical, and product-ready while protecting the existing core flow.

## Design goal

Arqis should feel like a simple but serious Arc Testnet payment workspace.

The interface should help users quickly understand:

- what Arqis does
- which payment module they are using
- which wallet/network is active
- what invoice information is being shown
- what is testnet-only
- what is planned for future verification and checkout flows

The UI should become more organized without becoming heavy or confusing.

## Suggested product framing

```text
Live Arc Testnet Payment Workspace
```

Alternative shorter labels:

```text
Arc Testnet Payment Workspace
Stablecoin Invoice Workspace
Arqis Payment Workspace
```

Recommended primary wording:

```text
Live Arc Testnet Payment Workspace
```

This sounds technical and active, while still being honest that the product is on testnet.

## Proposed layout

```text
┌─────────────────────────────────────────────────────────────┐
│ Top Bar                                                     │
│ Arqis | Live Arc Testnet Payment Workspace | Wallet Status  │
├───────────────┬───────────────────────────────┬─────────────┤
│ Left Sidebar  │ Main Workspace                │ Right Rail   │
│               │                               │             │
│ Create Invoice│ Active module content         │ Status      │
│ Pay Invoice   │                               │ Quick Links │
│ Seller Console│                               │ Testnet Note│
│ Wallet Setup  │                               │             │
│ Docs          │                               │             │
└───────────────┴───────────────────────────────┴─────────────┘
```

## Top bar

Purpose: give the app a clear workspace identity.

Possible elements:

- Arqis logo/name
- workspace label
- current network
- selected wallet
- connect wallet button

Example:

```text
Arqis · Live Arc Testnet Payment Workspace · USDC · Wallet: Connected
```

If no wallet is connected:

```text
Arqis · Live Arc Testnet Payment Workspace · USDC · Wallet: Not connected
```

## Left sidebar modules

The sidebar should make Arqis feel organized into clear product modules.

Initial modules:

```text
Invoice
- Create Invoice
- Pay Invoice
- Seller Console

Wallet
- Connect Wallet
- Wallet QR
- Arc Setup

Resources
- Docs
- Roadmap
```

Future modules could include:

```text
- Public Invoice Links
- QR Checkout
- Receipts
- Assets
- Payment Verification
```

Important: future modules should be marked as planned if not live.

## Main workspace

The center area should keep the current core app flow.

This is where the existing product sections can live:

- Create Invoice
- Pay Invoice / Inbox
- Seller Console
- Wallet setup

The main workspace should not hide important invoice details. Invoice payment information should remain clear:

- amount
- asset
- network
- seller/recipient
- memo
- expiry
- payment status

## Right rail

The right side can make the app feel more technical and trustworthy without overclaiming.

Suggested cards:

### Network Status

```text
Arc Testnet: Active
USDC: Supported
Wallet Payment: Prototype
Server Verification: Planned
```

### Wallet Status

```text
Wallet: Connected / Not connected
Selected wallet: MetaMask / OKX / Rabby / Unknown
Network: Arc Testnet
```

### Quick Links

```text
ArcScan
Arc Testnet Setup
Circle Faucet
Docs
Roadmap
```

### Testnet Notice

```text
Arqis is currently a testnet-stage prototype. Payments are for Arc Testnet only. Production payment verification is planned and requires further backend/security work.
```

## Copy principles

Use clear, honest wording.

Good wording:

```text
Testnet prototype
Wallet payment submitted
Server verification planned
Direct wallet payment
Small-payment friendly
Clear invoice details
```

Avoid overclaiming:

```text
Production-ready
Payment guaranteed
Instantly confirmed
Lowest fees guaranteed
Bank-grade security
Fully verified payment processor
```

## Core flow protection

Any UI migration must protect these flows:

1. Open `/home`
2. Open `/`
3. Register or restore Arqis name
4. Connect installed desktop wallet
5. Preserve mobile wallet behavior unless explicitly changed
6. Create invoice
7. See invoice in inbox/payment flow
8. Submit Arc Testnet USDC wallet payment
9. View seller console
10. Load QR library successfully
11. Open docs links

## Suggested implementation plan

### Step 1 — Concept document

Create this document.

Status: done.

No app testing required because no app files are changed.

### Step 2 — Static mockup only

Create a separate preview file, for example:

```text
docs/workspace-preview.html
```

This should not replace `home.html` or `index.html`.

Testing required:

- open preview page locally
- check visual direction
- confirm wording feels right
- no wallet/payment testing needed because it is mockup only

### Step 3 — Apply layout shell carefully

If the mockup is approved, apply only the layout shell to the real app.

Do not change payment/wallet logic in this step.

Testing required:

- `/home` loads
- `/` loads
- wallet selector opens
- existing sections are still visible
- mobile layout still readable

### Step 4 — Move existing sections into modules

Move current UI sections into the new workspace areas one by one.

Testing required after each section:

- Create Invoice works after moving create section
- Pay Invoice works after moving payment section
- Seller Console works after moving seller section
- Wallet modal works after moving wallet controls

### Step 5 — Add status and quick-link cards

Add right rail cards after core sections are stable.

Testing required:

- cards display correct text
- no false production/security claims
- links open correctly

## Current recommendation

Do not modify `home.html` or `index.html` yet.

First create a separate visual preview, review it, then migrate the real app only after approval.
