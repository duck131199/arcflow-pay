# Arqis Project Structure

This document explains the current Arqis project layout and the intended cleanup direction.

The goal is to make the project easier to understand and maintain without breaking the current prototype flow.

## Current stage

Arqis is currently a static MVP/testnet prototype. Most of the application UI, styles, and browser-side logic are still inside the main HTML files.

This is acceptable for the current stage because it keeps deployment simple and allows fast iteration. As the product grows, we will gradually separate assets, scripts, documentation, and product modules in small verified steps.

## Main entry files

```text
home.html
index.html
docs.html
okx-test.html
```

### `home.html`

Primary public app page for the Arqis prototype.

Contains the main user-facing flow, including:

- Arqis name registration
- invoice creation
- invoice inbox/payment flow
- wallet connection and installed-wallet selector
- seller console
- Arc Testnet USDC payment prototype

This is a core flow file. Changes should be small and verified carefully.

### `index.html`

Root app entry page. Currently mirrors the main app experience closely.

This is also a core flow file. Changes should be kept in sync with `home.html` when needed.

### `docs.html`

Documentation landing page.

Links to the product and technical documentation pages.

### `okx-test.html`

Local/test helper page for OKX wallet and wallet connection experiments.

This is not part of the main user-facing app flow.

## Assets

```text
assets/
  og-arqis.png
  qrcode.js
```

### `assets/og-arqis.png`

Open graph / social preview image used by public pages.

### `assets/qrcode.js`

QR code library used by the app.

Future cleanup may move vendor libraries into a clearer folder such as:

```text
assets/vendor/qrcode.js
```

If moved, all script references must be updated and tested.

## Documentation files

```text
docs/
  arc-testnet-setup.md
  circle-faucet-setup.html
  create-invoice.html
  future-roadmap.html
  future-roadmap.md
  mvp-sections.md
  overview.md
  pay-invoice.html
  product-flow.md
  project-structure.md
  security-verification.html
  seller-console.html
  supabase-schema.sql
  update-invoice-expiry-constraint.sql
```

### Product docs

These explain how the prototype works from a user/product perspective:

```text
docs/create-invoice.html
docs/pay-invoice.html
docs/seller-console.html
docs/future-roadmap.html
docs/product-flow.md
docs/overview.md
docs/mvp-sections.md
```

### Technical/security docs

These explain setup, testnet, schema, and verification topics:

```text
docs/arc-testnet-setup.md
docs/circle-faucet-setup.html
docs/security-verification.html
docs/supabase-schema.sql
docs/update-invoice-expiry-constraint.sql
```

## Files not to commit unless explicitly requested

The following currently exist as local/untracked work or research material and should not be committed by default:

```text
.tmp-okx-research/
docs/draft-public-testnet-hardening.sql
```

## Core flows to protect

When changing the project structure, these flows must remain working:

1. Open app page
2. Register / restore Arqis name
3. Connect installed desktop wallet
4. Keep mobile wallet behavior unchanged unless explicitly requested
5. Create invoice
6. Open invoice inbox / payment flow
7. Submit Arc Testnet USDC payment flow
8. View seller console
9. Open documentation pages
10. Load QR code library successfully

## Cleanup principles

Future cleanup should follow these rules:

- Do not rewrite the app from scratch.
- Do not migrate to React/Next unless explicitly decided later.
- Do not change wallet/payment logic during file-organization steps.
- Move one small group of files at a time.
- After each step, run local checks before pushing.
- Keep `home.html` and `index.html` behavior aligned.
- Preserve public URLs where possible.
- If a public URL must change, add a redirect or update docs before deployment.

## Suggested next cleanup steps

### Step 1 — Document structure

Create this project structure document.

Status: done.

### Step 2 — Organize assets safely

Possible future structure:

```text
assets/
  images/
    og-arqis.png
  vendor/
    qrcode.js
```

This step requires updating references in:

```text
home.html
index.html
docs.html
```

Testing required:

- homepage loads
- root page loads
- docs page loads
- QR-related UI still works
- social image reference still resolves

### Step 3 — Organize documentation grouping

Possible future structure:

```text
docs/
  product/
  technical/
  roadmap/
```

This step requires careful link updates. It should only be done after checking all existing links.

Testing required:

- every docs link opens
- browser back/navigation still makes sense
- public docs URLs are not unexpectedly broken

### Step 4 — Split CSS only

Possible future structure:

```text
assets/css/app.css
assets/css/docs.css
```

This is safer than splitting JavaScript first, but still requires visual testing.

Testing required:

- homepage layout unchanged
- wallet modal layout unchanged
- invoice cards look correct
- seller console layout unchanged
- docs pages remain readable

### Step 5 — Split JavaScript gradually

Possible future structure:

```text
assets/js/config.js
assets/js/wallet.js
assets/js/invoices.js
assets/js/seller-console.js
assets/js/utils.js
```

This is the highest-risk cleanup step and should be done only in small pieces with syntax and browser testing after each piece.

Testing required:

- wallet connect
- wallet restore after refresh
- create invoice
- pay invoice
- seller console
- QR generation
- Supabase reads/writes

## Current recommendation

Start with documentation and low-risk asset organization. Delay JavaScript splitting until the app flows are stable and there is a clear test checklist for each module.
