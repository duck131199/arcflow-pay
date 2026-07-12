# Arqis CCTP Fulfiller Repayment Plan

## TL;DR

Use `circlefin/circle-cctp-fulfiller-repayment` as a **Phase 2 backend settlement engine pattern** for Arqis, not as a replacement for the existing `pay-invoice` app.

The current Arqis Pay Invoice product should remain an **Arc Testnet USDC invoice checkout**. The Circle demo is most useful for the next layer: **payer/payment on Arc, seller receives USDC quickly on another chain, and Arqis settles/reimburses the fulfiller later through Circle CCTP**.

In product terms:

```text
Phase 1: Pay invoice with USDC on Arc Testnet.
Phase 2: Pay/settle on Arc, seller receives fast on a destination chain.
Phase 3: Multiple fulfillers, quotes, limits, risk controls, and mainnet settlement.
```

## Why this matters

The current unified/Gateway/CCTP assist flow makes the payer deal with cross-chain complexity:

```text
payer has source-chain USDC
→ payer needs source-chain gas
→ payer signs / submits Gateway or CCTP flow
→ USDC arrives on Arc
→ payer pays invoice
```

This is useful for testnet primitives, but it is not ideal checkout UX. Users can have enough USDC and still fail because they lack native gas on the source chain or because the wallet blocks the signing path.

The fulfiller repayment pattern moves cross-chain complexity behind Arqis:

```text
invoice is payable / verified
→ Arqis selects a fulfiller
→ fulfiller pays seller quickly on the seller's destination chain
→ Arqis treasury settles through CCTP
→ repayment escrow releases USDC back to the fulfiller
```

The seller can see **Paid to seller** before CCTP settlement and repayment fully complete.

## What the Circle demo provides

The referenced demo repo models a narrow but valuable settlement lifecycle:

```text
intent_created
→ payout_sent
→ fulfilled / repayment_registered
→ settlement_pending
→ mint_completed
→ repaid
```

Core pieces:

- `IntentRepaymentEscrow.sol`: minimal repayment escrow for a fulfiller.
- `src/lib/cctp.ts`: CCTP burn, Iris attestation polling, and destination mint.
- mock fulfiller selection based on fee, speed, and max amount.
- local demo state in `data/intents.json`.
- local server endpoints for intent, fulfill, settle, balances, and status.

It is a demo, not a production payment system.

## How it maps to Arqis

| Arqis module | Phase 2 settlement upgrade |
|---|---|
| Create Invoice | Seller may choose receive chain and receive wallet |
| Pay Invoice | After payer payment/verification, create a settlement intent |
| Receipt box | Show payment status separately from settlement status |
| Seller Console | Show seller payout tx, CCTP txs, repayment tx, fees, and status |
| Unified balance | Becomes payment assist / future routing input, not the main product story |
| Telegram bot | Alert when seller is paid and when settlement completes |
| Arcscan link | Add destination explorer links and CCTP/repayment links |

## Product boundary

Do **not** copy the Circle demo into the frontend.

The correct shape is:

```text
Arqis Frontend
  - Create Invoice
  - Pay Invoice
  - Seller Console
  - Wallet Setup

Arqis Backend / Supabase Functions
  - Invoice DB
  - Payment verifier
  - Fulfiller selection
  - Payout verifier
  - CCTP settlement worker
  - Repayment worker
  - Telegram / notification worker

On-chain
  - Arc treasury / payment contracts
  - Destination USDC payout
  - IntentRepaymentEscrow
```

The frontend should call high-level Arqis APIs, not CCTP primitives directly.

## Payment status vs settlement status

Arqis should keep payment status separate from settlement status.

### Payment status

This is what payer/seller care about.

```text
created
payable
payment_submitted
verification_pending
paid_to_seller
failed
expired
refunded
```

### Settlement status

This is what backend/operator/Seller Console advanced details care about.

```text
none
intent_created
fulfiller_selected
payout_sent
payout_verified
repayment_registered
cctp_burn_submitted
attestation_pending
mint_completed
repaid
settlement_failed
manual_review
```

A seller-facing invoice can be `paid_to_seller` while settlement remains `attestation_pending` or `repaid` later.

## Supabase tables to add

Minimum Phase 2 tables:

### `payment_attempts`

Tracks payer-side attempts.

```text
id
invoice_id
payer_wallet
chain_id
token_contract
amount_usdc
tx_hash
status
error_code
created_at
updated_at
```

### `settlement_intents`

One settlement plan for a verified invoice/payment.

```text
id
invoice_id
payment_attempt_id
source_chain
destination_chain
seller_recipient
amount_usdc
priority
max_fee_bps
status
created_at
updated_at
```

### `fulfillers`

Fulfiller registry.

```text
id
name
wallet_address
supported_chains
fee_bps
max_amount_usdc
status
speed_rank
exposure_limit_usdc
created_at
updated_at
```

### `fulfiller_payouts`

Tracks the fronted seller payout.

```text
id
settlement_intent_id
fulfiller_id
destination_chain
recipient_address
amount_usdc
fee_usdc
tx_hash
status
verified_at
created_at
updated_at
```

### `cctp_messages`

Tracks CCTP settlement.

```text
id
settlement_intent_id
source_chain
destination_chain
source_domain
destination_domain
burn_tx_hash
message_hash
attestation
mint_tx_hash
status
created_at
updated_at
```

### `repayments`

Tracks repayment escrow state.

```text
id
settlement_intent_id
fulfiller_id
escrow_address
principal_usdc
fee_usdc
total_usdc
register_tx_hash
release_tx_hash
status
created_at
updated_at
```

### `settlement_events`

Append-only event log for audit and Seller Console.

```text
id
settlement_intent_id
invoice_id
type
chain_id
tx_hash
payload_json
created_at
```

## Backend APIs

Suggested internal APIs:

| API | Purpose |
|---|---|
| `POST /settlement/intents` | Create settlement intent from a verified invoice/payment |
| `POST /settlement/quote` | Quote fulfiller fee and destination payout route |
| `POST /settlement/fulfill` | Select/request fulfiller payout |
| `POST /settlement/payouts/verify` | Verify seller payout tx |
| `POST /settlement/cctp/start` | Burn USDC from Arc treasury/source |
| `POST /settlement/cctp/attestation` | Poll/fetch Iris attestation |
| `POST /settlement/cctp/mint` | Complete destination mint |
| `POST /settlement/repay` | Release repayment to fulfiller |
| `GET /settlement/:invoiceId` | Return payment + settlement status for UI |

These APIs should be idempotent. Workers must tolerate retries and partial completion.

## Contract changes from the demo

The demo escrow is good for learning, but too trusted for production.

Minimum MVP upgrade:

```solidity
struct Repayment {
  address fulfiller;
  address recipient;
  uint256 principal;
  uint256 fee;
  uint256 total;
  uint64 sourceDomain;
  uint64 destinationDomain;
  uint256 deadline;
  bytes32 payoutTxRef;
  RepaymentStatus status;
}
```

Needed functions/events:

```text
registerRepayment(intentId, fulfiller, recipient, principal, fee, deadline, payoutTxRef)
releaseToFulfiller(intentId)
cancelExpired(intentId)
pause()
unpause()

RepaymentRegistered
RepaymentFunded
FulfillerRepaid
RepaymentCancelled
```

MVP can remain operator-trusted, but must emit enough events for indexing and audit.

Production needs more:

- role-based access, not a single operator;
- pause/emergency stop;
- fee/reward accounting;
- dispute/cancel paths;
- proof/reference for payout tx;
- per-intent funded accounting;
- deployment and migration strategy;
- audit before mainnet funds.

## Fulfiller selection roadmap

Demo selection uses static fee, speed, and max amount. Arqis should start simpler than a marketplace.

### Phase 2A: Arqis treasury fulfiller only

```text
fulfiller = Arqis treasury wallet
fee_bps = fixed/configured
max_amount = configured cap
supported_destination_chains = allowlist
```

### Phase 2B: small private fulfiller set

Add:

- live USDC balance check;
- native gas check;
- uptime/fail-rate tracking;
- per-fulfiller exposure limits;
- dynamic quotes;
- manual disable/enable.

### Phase 3: fulfiller network

Add:

- quote competition;
- collateral/slashing or legal agreements;
- compliance and sanctions checks;
- risk scoring;
- automated dispute paths;
- SLA monitoring.

## Verification requirements

Before Arqis repays a fulfiller, backend must verify the payout tx:

```text
- correct destination chain
- correct USDC token contract
- recipient equals invoice seller receive wallet
- amount >= required payout amount
- tx confirmed/finalized
- tx not reused for another intent
- fulfiller address matches selected fulfiller
```

Before creating a settlement intent, backend must verify the payer/invoice payment:

```text
- invoice exists and is payable
- payment tx exists
- correct chain/token/recipient
- amount is sufficient
- invoice not expired
- tx not reused
- confirmation threshold met
```

If Arqis lets a fulfiller pay seller before payer funds are final, Arqis takes credit/fraud risk.

## Security and operations

Do not run production private keys like the demo `.env` pattern.

Use:

- KMS/HSM or signer service;
- hot wallet limits;
- per-chain spending caps;
- treasury multisig for large balances;
- abnormal settlement alerts;
- idempotent workers;
- retry/backoff and stuck-state monitoring;
- append-only event logs;
- reconciliation jobs.

## UI direction

For Phase 1, keep the product story simple:

```text
Arc USDC checkout
Pay invoice with USDC on Arc Testnet.
Need USDC? Use payment assist to prepare funds.
```

Avoid making Gateway/CCTP the headline. They are assist/advanced mechanisms.

For Phase 2, use product language like:

```text
Fast USDC settlement
Seller receives USDC on [destination chain]
Arqis handles settlement after payment.
```

Advanced details may show:

```text
Settlement route: Arc → Ethereum Sepolia via Circle CCTP
Fulfiller: Arqis Treasury / beta
Fee: 12 bps
Seller payout: sent
CCTP settlement: attestation pending
Repayment: pending / completed
```

## Immediate implications for current localhost UI

The current `Gateway Gasless Mint` assist can be misleading when the payer still needs source-chain gas.

Short-term fixes:

- show source-chain gas status before enabling the action;
- separate `USDC enough` from `gas enough`;
- avoid calling the user-facing action simply `Gasless` when it can require gas;
- keep `CCTP Direct` as advanced/unavailable when wallet support is missing;
- make Arc direct invoice payment remain the primary checkout story.

## Implementation phases

### Phase 1: Honest Arc checkout + payment assist

- Keep current Arc Testnet USDC invoice checkout.
- Add source gas checks for payment assist.
- Rename confusing copy around Gateway/Gasless if source gas is required.
- Keep CCTP Direct in advanced details.

### Phase 2A: Single-operator settlement engine

- Add Supabase tables.
- Add backend worker for settlement intents.
- Use Arqis treasury as the only fulfiller.
- Verify payout tx before repayment.
- Integrate CCTP Arc Testnet → Ethereum Sepolia.
- Surface settlement status in Seller Console.

### Phase 2B: More destinations and operational hardening

- Generalize chain config.
- Add Base Sepolia / other supported testnets if CCTP routes exist.
- Add retries, alerts, reconciliation, caps, and dashboarding.

### Phase 3: Fulfiller network

- Multiple fulfillers.
- Dynamic quotes.
- Liquidity/risk scoring.
- Collateral/slashing or off-chain agreements.
- Mainnet audit and production controls.

## Mainnet missing pieces

Before mainnet:

- Circle CCTP/Gateway support for selected chains and Arc mainnet;
- production USDC contract allowlist;
- audited repayment escrow;
- backend verifier and worker reliability;
- KMS/HSM signer setup;
- liquidity management;
- compliance/risk policy;
- clear fee model;
- incident response and manual review tooling;
- data reconciliation between Supabase, on-chain events, and notifications.

## Decision

Treat `circle-cctp-fulfiller-repayment` as the **Phase 2 settlement architecture reference**.

Do not replace the current Arqis Pay Invoice UI with it. Keep Pay Invoice focused on invoice UX, and move CCTP/fulfiller repayment into backend settlement and Seller Console advanced tracking.
