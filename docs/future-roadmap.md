# Future Roadmap

Arqis is intentionally starting with a small invoice payment MVP.

## Product Direction

Arqis is **Arqis-name + invoice-inbox first**, not payment-link-first.

Core direction:

- Seller sends an invoice to an Arqis name, for example `@payer`
- The invoice appears in the payer's Pay Invoice inbox
- The payer opens Arqis, reviews the invoice, and pays from wallet
- Seller receives USDC and both sides see the invoice lifecycle

Payment links and invoice QR codes are optional future helpers, not the primary product model. Wallet QR remains useful for direct receives, but invoice tracking should live in Arqis inbox/status/receipt flows.

The following features are out of scope for the first prototype but are useful future directions.

## Real Invoice Backend

- Generate real invoice IDs and reference codes
- Store invoice state
- Track expiry
- Persist payment status
- Support seller accounts/settings

## Wallet and RPC Integration

- Connect wallet
- Detect Arc Testnet / Arc Mainnet
- Read USDC balances
- Prepare payment transactions
- Monitor transaction status

## Seller Settings

- Configure settlement wallet once
- Manage display name/business name
- Configure fee policy
- Configure default expiry


## Universal Balance Pay

These are future product directions. They should not be interpreted as features available in the current testnet prototype. Multi-asset routing, bridge/swap into USDC, and Dust-to-USDC cleanup will be considered after the core USDC invoice flow is validated.

Future payer-side routing layer:

- Let payers complete a USDC invoice using value from multiple assets and chains
- Example: invoice is 1,000 USDC, payer has 500 USDC + 250 BNB + 100 ETH + 300 BTC value
- Arqis proposes a route that can swap/bridge selected assets into USDC
- Seller still receives clean USDC settlement on Arc
- Payer must explicitly review and confirm the route before any swap, bridge, or spend happens
- Receipt should show route transparency for the payer while keeping seller settlement simple

This makes Arqis more than a payment link: it becomes a payment router for people who have enough value, but not all in the right asset or chain.

## Dust-to-USDC / Small Balance Cleanup

Future wallet utility inside checkout:

- Detect small token balances, for example assets worth less than 5 USD
- Ask the payer whether they want to hide small balances or convert them into USDC
- Let payer batch tiny balances into USDC where liquidity and fees make sense
- Use the converted USDC toward invoice payment or keep it as usable Arqis balance
- Show clear warnings when gas, slippage, or fees would make conversion not worth it

Example UX:

> You have 7 small balances under $5. Hide them, or convert eligible balances to USDC?

This is inspired by the common exchange pattern of hiding small assets or converting dust, but Arqis should optimize toward USDC because the payment product settles around USDC.

## Invoice Inbox Experience

This replaces payment-link/QR as the main next product direction after the core invoice flow is stable.

- Better Pay Invoice inbox
- Invoice detail drawer/page
- Receipt view
- New/payable invoice badge
- Due-soon and expired indicators
- Optional reminders before expiry
- In-app notification history

## Optional Payment Links / Invoice QR

These are not core to the current Arqis vision. Consider them only for later edge cases:

- Guest payer who does not have an Arqis account
- Merchant wants to share an invoice outside Arqis
- Printed invoices or embedded checkout

Do not let payment links or invoice QR drive the main product roadmap.

## API + Webhooks

Future developer product:

- Create payment intents
- Retrieve invoice status
- Receive `payment.settled` events
- Integrate with eCommerce, SaaS billing, or marketplace backends

## Production Checkout

- Remove faucet onboarding
- Add real wallet connection
- Show real payment preview
- Require explicit payer confirmation
- Show receipt and Arcscan link after payment

## Agent Payments

Long-term direction:

- Agent budgets
- Usage-based payments
- Escrowed jobs
- Autonomous USDC settlement

Agent Payments should come after the core invoice/payment flow is validated.
