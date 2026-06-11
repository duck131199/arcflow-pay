# Arqis Testing Checklist

Use this checklist after every change that could affect the app, layout, wallet flow, invoice flow, QR generation, or documentation links.

For documentation-only changes, app testing is usually not required unless public docs links are changed.

## Change risk levels

### Low risk

Examples:

```text
new internal .md document
copy-only docs edit
roadmap wording update
```

Testing required:

```text
- confirm file exists
- confirm wording is accurate
- no app flow testing required
```

### Medium risk

Examples:

```text
HTML copy changes
CSS/layout changes
asset path changes
docs link changes
```

Testing required:

```text
- homepage loads
- root page loads
- relevant links open
- layout still looks correct
- mobile layout still readable if affected
```

### High risk

Examples:

```text
wallet JavaScript changes
invoice creation changes
payment submission changes
Supabase read/write changes
QR generation changes
seller console changes
```

Testing required:

```text
- full core flow test
- browser console check
- syntax check
- local served page check
```

## Core smoke test

Run this after medium/high-risk changes.

### 1. Home page

Open:

```text
/home
```

Check:

```text
- page loads
- Arqis branding appears
- main sections render
- no obvious layout break
```

### 2. Root page

Open:

```text
/
```

Check:

```text
- page loads
- content matches intended app entry
- no missing script or asset errors
```

### 3. Wallet selector

Check:

```text
- connect wallet button opens wallet selector
- installed wallets appear if available
- no fake Popular wallets section appears
- selected wallet can be restored after refresh where supported
```

### 4. Mobile wallet behavior

Only test if wallet/mobile code or layout changed.

Check:

```text
- mobile behavior is unchanged unless explicitly intended
- mobile can still route to wallet app/open flow
```

### 5. Create invoice

Check:

```text
- seller can enter invoice details
- expiry options appear correctly: 6h, 12h, 24h, 3d, 7d
- invoice can be created without Supabase constraint errors
- created invoice data looks correct
```

### 6. Pay invoice

Check:

```text
- payer can open invoice/payment flow
- invoice amount, asset, recipient, memo, network, and expiry are visible
- wallet payment flow can be started
- wording says transaction submitted, not falsely production-confirmed
```

### 7. Seller console

Check:

```text
- seller console opens
- invoice/payment activity appears
- no old placeholder data appears
- no hardcoded demo invoice/address values appear
```

Avoid reintroducing old placeholders such as:

```text
+1.902764
Invoice #AF-2048
af_2048
0x256e...b01f
```

### 8. QR generation

Check if QR library or paths changed:

```text
- QR appears where expected
- browser console does not show QRCode is not defined
- wallet QR is still described as direct transfer only
```

### 9. Docs links

Check:

```text
- docs landing opens
- Create Invoice docs open
- Pay Invoice docs open
- Seller Console docs open
- Security/Verification docs open
- Roadmap docs open if linked
```

## Browser console checks

Look for errors such as:

```text
QRCode is not defined
supabase is not defined
ethereum is not defined
Cannot read properties of undefined
Failed to fetch
404 for assets/qrcode.js
404 for assets/og-arqis.png
```

## Copy checks

For testnet honesty, keep wording aligned with:

```text
Testnet MVP
Arc Testnet
transaction submitted
server verification planned
not production payment processing
```

Avoid wording such as:

```text
payment guaranteed
production-ready
fully verified
lowest fees guaranteed
instant confirmed payment
```

## Before pushing

Before pushing medium/high-risk changes:

```text
- check git diff
- confirm only intended files changed
- run syntax/static checks where possible
- run local served page check
- summarize what the user should test
```

## Current protected flows

These are the most important flows to avoid breaking:

```text
Create Invoice
Pay Invoice
Seller Console
Wallet Selector
Mobile Wallet Flow
QR Generation
Supabase Reads/Writes
Docs Navigation
```
