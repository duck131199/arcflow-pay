# Arqis Payment Lifecycle

This document defines the intended payment lifecycle for Arqis invoice payments.

The goal is to make payment states clear for users, sellers, and future technical implementation.

## Current status

Arqis is currently a testnet-stage prototype.

Current payment behavior:

```text
invoice created → payer reviews → wallet submits transaction → app shows submitted/receipt state
```

Current flow is useful for testnet demonstration, but it is not yet production-grade payment verification.

## Recommended invoice states

Future invoice/payment state should be explicit and consistent.

```text
draft
unpaid
submitted
confirmed
failed
expired
cancelled
```

## State definitions

### `draft`

Invoice is being prepared but has not been issued yet.

### `unpaid`

Invoice has been created and is waiting for payment.

### `submitted`

Payer has submitted a wallet transaction.

This does not necessarily mean the payment is fully verified yet.

### `confirmed`

Payment has been verified by a trusted backend/indexer.

Future verification should confirm:

```text
- correct chain
- correct token
- correct amount
- correct recipient
- valid transaction hash
- sufficient confirmation
- invoice not expired
- transaction not reused
```

### `failed`

Payment attempt failed, reverted, used the wrong asset/network, or could not be verified.

### `expired`

Invoice is past its expiry time and should no longer accept payment as valid without seller action.

### `cancelled`

Seller or system cancelled the invoice before payment confirmation.

## Current prototype lifecycle

```text
unpaid
  ↓
submitted
  ↓
receipt state / seller console activity
```

Current prototype wording should use:

```text
transaction submitted
wallet confirmation
receipt state
```

Avoid implying production finality with wording such as:

```text
payment guaranteed
payment fully verified
production confirmed
bank-grade settlement
```

## Future verified lifecycle

```text
unpaid
  ↓
submitted
  ↓
backend verification pending
  ↓
confirmed / failed / expired
```

## Future verifier checks

A future verifier should check the transaction against the invoice record:

```text
invoice_id
tx_hash
chain_id
token_contract
expected_amount
actual_amount
seller_recipient
payer_wallet
block_number
confirmation_count
expiry_time
```

## Receipt requirements

A future receipt should show:

```text
invoice ID
seller
payer wallet
asset
amount
network
transaction hash
status
submitted time
confirmed time if available
ArcScan link
```

## Seller console requirements

Seller console should eventually distinguish clearly between:

```text
unpaid invoices
submitted but unverified payments
confirmed payments
failed payments
expired invoices
```

## Product principle

The payer should always understand what they are paying.

The seller should always understand whether a payment is merely submitted or actually verified.

This distinction is important for future mainnet readiness.
